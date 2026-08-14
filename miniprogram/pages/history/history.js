const db = require('../../utils/db')
const { formatDateCN, formatDateTime, formatDate } = require('../../utils/format')

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

Page({
  data: {
    records: [],
    periods: [],           // 月经记录（供查看/删除）
    loading: true,
    empty: false,
    // 月历
    weekLabels: ['一', '二', '三', '四', '五', '六', '日'],
    year: 0,
    month: 0,
    monthLabel: '',
    days: []
  },

  onLoad() {
    const now = new Date()
    this.todayStr = formatDate(now)
    this.recordMap = {}
    this.periodMap = {}
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 })
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })

    // 1) 读取体温记录（失败也继续，保证月历始终渲染）
    let list = []
    try {
      list = await db.getAllRecords()
    } catch (e) {
      console.error(e)
      const info = db.friendlyError(e)
      wx.showModal({ title: '云环境异常', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    }
    const records = list.map(r => ({
      _id: r._id,
      date: r.date,
      temp: r.temp,
      dateCN: formatDateCN(new Date(r.date + 'T00:00:00')),
      createdText: formatDateTime(r.createdAt) // 创建时间，精确到秒
    }))
    // 日期 -> 记录 映射，供月历使用
    this.recordMap = {}
    records.forEach(r => { this.recordMap[r.date] = { _id: r._id, temp: r.temp } })

    // 2) 读取月经周期（periods 集合未创建时不阻塞月历显示）
    let periods = []
    try {
      periods = await db.getPeriods()
    } catch (e) {
      console.error('读取月经周期失败（若未创建 periods 集合，请按 README 创建）：', e)
    }
    this.buildPeriodMap(periods)
    const periodView = periods.map(p => ({
      _id: p._id,
      label: (p.startDate ? p.startDate.slice(5).replace('-', '/') : '?') +
        ' ~ ' +
        (p.endDate ? p.endDate.slice(5).replace('-', '/') : '至今')
    }))

    // 3) 渲染列表 + 月历 + 月经记录
    this.setData({ records, periods: periodView, empty: records.length === 0, loading: false })
    try {
      this.buildCalendar()
    } catch (e) {
      console.error('月历构建失败：', e)
    }
  },

  // 把每个周期展开成日期集合（开始~结束含；未结束的到今天）
  buildPeriodMap(periods) {
    const map = {}
    periods.forEach(p => {
      const start = p.startDate
      const end = p.endDate || this.todayStr
      if (!start || end < start) return
      let cur = start
      let i = 0
      while (cur <= end && i < 500) {
        map[cur] = true
        cur = this.addDays(cur, 1)
        i++
      }
    })
    this.periodMap = map
  },

  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + n)
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  },

  // 生成当前月份的日历格子
  buildCalendar() {
    const recordMap = this.recordMap || {}
    const periodMap = this.periodMap || {}
    const { year, month } = this.data
    const first = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const lead = (first.getDay() + 6) % 7 // 周一为一周第一天
    const days = []
    for (let i = 0; i < lead; i++) {
      days.push({ key: 'empty-' + i, empty: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = year + '-' + pad(month) + '-' + pad(d)
      const rec = recordMap[date]
      const menstruation = !!periodMap[date]
      // 计算月经"长带"的带首/带尾（跨周边界也视为断点，保证两端有弧度）
      const col = (lead + d - 1) % 7 // 0=周一
      const prevDate = this.addDays(date, -1)
      const nextDate = this.addDays(date, 1)
      const runStart = menstruation && (!periodMap[prevDate] || col === 0)
      const runEnd = menstruation && (!periodMap[nextDate] || col === 6)
      days.push({
        key: date,
        day: d,
        date,
        recorded: !!rec,
        tempText: rec ? rec.temp.toFixed(1) : '',
        menstruation: menstruation,
        runStart: runStart,
        runEnd: runEnd,
        isToday: date === this.todayStr
      })
    }
    this.setData({ days, monthLabel: year + '年' + month + '月' })
  },

  prevMonth() {
    const d = new Date(this.data.year, this.data.month - 2, 1)
    this.setData({ year: d.getFullYear(), month: d.getMonth() + 1 }, () => this.buildCalendar())
  },

  nextMonth() {
    const d = new Date(this.data.year, this.data.month, 1)
    this.setData({ year: d.getFullYear(), month: d.getMonth() + 1 }, () => this.buildCalendar())
  },

  // 点击已记录的日期 → 进入详情
  onDayTap(e) {
    const date = e.currentTarget.dataset.date
    const recorded = e.currentTarget.dataset.recorded
    if (!recorded) return
    const rec = this.recordMap[date]
    if (rec) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + rec._id })
    }
  },

  // 删除一次月经记录（误操作纠错）
  onPeriodDel(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除月经记录',
      content: '删除这次月经记录？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#e53935',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await db.deletePeriod(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.load()
        } catch (err) {
          console.error(err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  }
})
