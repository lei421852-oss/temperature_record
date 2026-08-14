const config = require('../../config')
const db = require('../../utils/db')
const account = require('../../utils/account')
const { formatDate, formatDateCN } = require('../../utils/format')
const temp = require('../../utils/temp')

Page({
  data: {
    today: '',                       // 今天（限制不能选未来日期）
    selectedDate: '',                // 当前选择/记录的日期（默认今天，可补记过去）
    selectedDateCN: '',              // 展示用
    selectedDateShort: '',           // 如 04-01
    isBackfill: false,               // 是否补记过去日期
    tempOptions: temp.tempOptions(), // 滚动选择项：35.0 ~ 42.0，0.1 为单位
    pickerValue: [0],                // 滚动选择器当前下标
    temp: config.DEFAULT_TEMP,       // 当前选择的体温
    tempMin: config.TEMP_MIN,
    tempMax: config.TEMP_MAX,
    hint: '',                        // 提示文案（默认值来源）
    hasRecord: false,                // 所选日期是否已有记录
    saving: false,
    loaded: false,
    // 月经状态
    periodActive: false,
    periodId: '',
    periodStart: '',
    periodBtnText: '记录月经开始',    // 按钮文字（含所选日期）
    // 账号
    accountText: '',
    loggedIn: false,                 // 是否已登录（本地登录状态）
    showLoginSheet: false            // 登录面板（头像昵称填写）
  },

  async onLoad() {
    this.today = formatDate(new Date())
    await this.selectDate(this.today)
    this.loadPeriod()
    this.loadAccount()
    this.refreshLogin()
  },

  // 底部导航栏：同步选中「记录」；并刷新登录状态
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.refreshLogin()
  },

  // 刷新登录状态（本地存储，相当于 cookie）
  refreshLogin() {
    this.setData({ loggedIn: !!account.getLoginState() })
  },

  // 点击"微信登录"按钮 → 弹出登录面板（选择头像/填写昵称）
  onLoginTap() {
    this.setData({ showLoginSheet: true })
  },

  // 登录面板确认：e.detail = { nickname, avatarUrl }
  onLoginSheet(e) {
    const info = e.detail || {}
    this.setData({ showLoginSheet: false })
    this.doLoginWith(info)
  },

  onLoginSheetClose() {
    this.setData({ showLoginSheet: false })
  },

  async doLoginWith(info) {
    try {
      await account.doLogin(info)
      this.refreshLogin()
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  // 切换记录日期（默认今天；点击顶部日期可补记过去某天）
  async selectDate(date) {
    const isBackfill = date < this.today
    this.setData({
      selectedDate: date,
      selectedDateCN: formatDateCN(new Date(date + 'T00:00:00')),
      selectedDateShort: date.slice(5),
      isBackfill,
      periodBtnText: this.data.periodActive
        ? '结束月经（' + date.slice(5) + '）'
        : '记录月经开始（' + date.slice(5) + '）'
    })
    await this.loadForDate(date)
  },

  onDateChange(e) {
    this.selectDate(e.detail.value)
  },

  // 同步显示数值与滚动选择器位置
  applyTemp(value) {
    this.setData({ temp: value, pickerValue: [temp.tempIndex(value)] })
  },

  // 加载所选日期的记录：有则显示，没有则以上一次记录为默认值
  async loadForDate(date) {
    wx.showLoading({ title: '加载中', mask: true })
    try {
      const rec = await db.getRecordByDate(date)
      if (rec) {
        this.applyTemp(rec.temp)
        this.setData({
          hasRecord: true,
          hint: date + ' 已记录 ' + rec.temp + '℃，保存将更新并记修改日志'
        })
      } else {
        const latest = await db.getLatestRecord()
        if (latest) {
          this.applyTemp(latest.temp)
          this.setData({
            hasRecord: false,
            hint: '初始值 = 上一次记录：' + latest.temp + '℃（' + latest.date + '）'
          })
        } else {
          this.applyTemp(config.DEFAULT_TEMP)
          this.setData({
            hasRecord: false,
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
        this.setData({
          periodActive: true,
          periodId: p._id,
          periodStart: p.startDate,
          periodBtnText: '结束月经（' + this.data.selectedDateShort + '）'
        })
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
      const date = this.data.selectedDate
      const rec = await db.getRecordByDate(date)
      if (rec) {
        if (rec.temp === tempVal) {
          wx.showToast({ title: '体温未变化', icon: 'none' })
          return
        }
        await db.updateRecord(rec._id, date, rec.temp, tempVal)
        this.setData({ hint: date + ' 已记录 ' + tempVal + '℃，保存将更新并记修改日志' })
        wx.showToast({ title: '已更新', icon: 'success' })
      } else {
        await db.createRecord(date, tempVal)
        this.setData({
          hasRecord: true,
          hint: date + ' 已记录 ' + tempVal + '℃，保存将更新并记修改日志'
        })
        wx.showToast({ title: this.data.isBackfill ? '已补记' : '已保存', icon: 'success' })
      }
    } catch (e) {
      console.error(e)
      const info = db.friendlyError(e)
      wx.showModal({ title: '保存失败', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 月经开始 / 结束切换：点击记录开始，再点记录结束（按所选日期）
  async onPeriodTap() {
    if (this.periodBusy || this.data.saving) return
    this.periodBusy = true
    try {
      const date = this.data.selectedDate
      if (this.data.periodActive) {
        await db.endPeriod(this.data.periodId, date)
        this.setData({
          periodActive: false,
          periodId: '',
          periodStart: '',
          periodBtnText: '记录月经开始（' + this.data.selectedDateShort + '）'
        })
        wx.showToast({ title: '已记录结束', icon: 'success' })
      } else {
        const id = await db.startPeriod(date)
        this.setData({
          periodActive: true,
          periodId: id,
          periodStart: date,
          periodBtnText: '结束月经（' + this.data.selectedDateShort + '）'
        })
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

  // 误操作时删除本次月经记录
  onPeriodDelete() {
    if (!this.data.periodActive) return
    wx.showModal({
      title: '删除本次月经记录',
      content: '将删除始于 ' + this.data.periodStart + ' 的这条月经记录，不可恢复。确定删除？',
      confirmText: '删除',
      confirmColor: '#e53935',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await db.deletePeriod(this.data.periodId)
          this.setData({
            periodActive: false,
            periodId: '',
            periodStart: '',
            periodBtnText: '记录月经开始（' + this.data.selectedDateShort + '）'
          })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (e) {
          console.error(e)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goChart() {
    wx.navigateTo({ url: '/pages/chart/chart' })
  }
})
