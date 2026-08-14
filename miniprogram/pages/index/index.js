const config = require('../../config')
const db = require('../../utils/db')
const account = require('../../utils/account')
const { formatDate, formatDateCN } = require('../../utils/format')
const temp = require('../../utils/temp')

Page({
  data: {
    todayCN: '',                     // 今日日期（精确到日）
    tempOptions: temp.tempOptions(), // 滚动选择项：35.0 ~ 42.0，0.1 为单位
    pickerValue: [0],                // 滚动选择器当前下标
    temp: config.DEFAULT_TEMP,       // 当前选择的体温
    tempMin: config.TEMP_MIN,
    tempMax: config.TEMP_MAX,
    hint: '',                        // 提示文案（默认值来源）
    hasTodayRecord: false,
    saving: false,
    loaded: false,
    // 月经状态
    periodActive: false,             // 是否有进行中的月经周期
    periodId: '',                    // 进行中周期的 _id
    periodStart: '',                 // 进行中周期的开始日期
    // 账号
    accountText: ''                  // 当前账号（掩码显示）
  },

  async onLoad() {
    this.today = formatDate(new Date())
    this.setData({ todayCN: formatDateCN(new Date()) })
    await this.loadInit()
    this.loadPeriod()
    this.loadAccount()
  },

  // 同步显示数值与滚动选择器位置
  applyTemp(value) {
    this.setData({ temp: value, pickerValue: [temp.tempIndex(value)] })
  },

  // 初始值：今天的记录 > 上一条记录 > 常见体温(36.5)
  async loadInit() {
    wx.showLoading({ title: '加载中', mask: true })
    try {
      const todayRecord = await db.getRecordByDate(this.today)
      if (todayRecord) {
        this.applyTemp(todayRecord.temp)
        this.setData({
          hasTodayRecord: true,
          hint: '今日已记录 ' + todayRecord.temp + '℃，保存将更新并记修改日志'
        })
      } else {
        const latest = await db.getLatestRecord()
        if (latest) {
          this.applyTemp(latest.temp)
          this.setData({
            hint: '初始值 = 上一次记录：' + latest.temp + '℃（' + latest.date + '）'
          })
        } else {
          this.applyTemp(config.DEFAULT_TEMP)
          this.setData({
            hint: '暂无历史记录，默认体温 ' + config.DEFAULT_TEMP + '℃'
          })
        }
      }
      this.setData({ loaded: true })
    } catch (e) {
      console.error(e)
      const info = db.friendlyError(e)
      wx.showModal({
        title: '云环境异常',
        content: info.hint + '\n\n原始错误：' + info.raw,
        showCancel: false
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 读取进行中的月经周期，决定按钮状态
  async loadPeriod() {
    try {
      const p = await db.getOngoingPeriod()
      if (p) {
        this.setData({ periodActive: true, periodId: p._id, periodStart: p.startDate })
      }
    } catch (e) {
      // 若未创建 periods 集合，这里不影响体温记录功能
      console.error('读取月经周期失败（若未创建 periods 集合，请按 README 创建）：', e)
    }
  },

  // 获取并显示当前账号（掩码）
  async loadAccount() {
    const oid = await account.getOpenid()
    this.setData({ accountText: account.maskOpenid(oid) })
  },

  // 滚动选择变化：e.detail.value = [选中项下标]
  onPickerChange(e) {
    const idx = e.detail.value[0]
    this.setData({ temp: temp.tempValue(idx), pickerValue: [idx] })
  },

  async onSave() {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const tempVal = this.data.temp
      const todayRecord = await db.getRecordByDate(this.today)
      if (todayRecord) {
        if (todayRecord.temp === tempVal) {
          wx.showToast({ title: '体温未变化', icon: 'none' })
          return
        }
        await db.updateRecord(todayRecord._id, this.today, todayRecord.temp, tempVal)
        this.setData({ hint: '今日已记录 ' + tempVal + '℃，保存将更新并记修改日志' })
        wx.showToast({ title: '已更新', icon: 'success' })
      } else {
        await db.createRecord(this.today, tempVal)
        this.setData({
          hasTodayRecord: true,
          hint: '今日已记录 ' + tempVal + '℃，保存将更新并记修改日志'
        })
        wx.showToast({ title: '已保存', icon: 'success' })
      }
    } catch (e) {
      console.error(e)
      const info = db.friendlyError(e)
      wx.showModal({ title: '保存失败', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 月经开始 / 结束切换：点击记录开始，再点记录结束
  async onPeriodTap() {
    if (this.periodBusy || this.data.saving) return
    this.periodBusy = true
    try {
      if (this.data.periodActive) {
        await db.endPeriod(this.data.periodId, this.today)
        this.setData({ periodActive: false, periodId: '', periodStart: '' })
        wx.showToast({ title: '已记录结束', icon: 'success' })
      } else {
        const id = await db.startPeriod(this.today)
        this.setData({ periodActive: true, periodId: id, periodStart: this.today })
        wx.showToast({ title: '已记录开始', icon: 'success' })
      }
    } catch (e) {
      console.error(e)
      const info = db.friendlyError(e)
      wx.showModal({ title: '操作失败', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    } finally {
      this.periodBusy = false
    }
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goChart() {
    wx.navigateTo({ url: '/pages/chart/chart' })
  }
})
