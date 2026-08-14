const config = require('../../config')
const db = require('../../utils/db')
const { formatDateCN, formatDateTime } = require('../../utils/format')
const temp = require('../../utils/temp')

Page({
  data: {
    dateCN: '',
    tempOptions: temp.tempOptions(), // 滚动选择项：35.0 ~ 42.0，0.1 为单位
    pickerValue: [0],                // 滚动选择器当前下标
    temp: config.DEFAULT_TEMP,
    createdText: '',   // 创建时间，精确到秒
    updatedText: '',   // 最后修改时间
    logs: [],          // 创建 + 修改日志
    saving: false,
    loading: true
  },

  onLoad(options) {
    this.id = options.id
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      const record = await db.getRecordById(this.id)
      this.record = record
      const logs = await db.getLogsByDate(record.date)
      const logView = logs.map(l => ({
        time: l.time,
        timeText: formatDateTime(l.time),
        actionText: l.action === 'create' ? '创建记录' : '修改体温',
        changeText: l.action === 'create'
          ? '记录体温 ' + l.newTemp + '℃'
          : l.oldTemp + '℃ → ' + l.newTemp + '℃'
      }))
      this.setData({
        dateCN: formatDateCN(new Date(record.date + 'T00:00:00')),
        temp: record.temp,
        pickerValue: [temp.tempIndex(record.temp)],
        createdText: formatDateTime(record.createdAt),
        updatedText: formatDateTime(record.updatedAt),
        logs: logView,
        loading: false
      })
    } catch (e) {
      console.error(e)
      this.setData({ loading: false })
      const info = db.friendlyError(e)
      wx.showModal({ title: '云环境异常', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    }
  },

  // 滚动选择变化
  onPickerChange(e) {
    const idx = e.detail.value[0]
    this.setData({ temp: temp.tempValue(idx), pickerValue: [idx] })
  },

  async onSave() {
    if (this.data.saving || !this.record) return
    const newTemp = this.data.temp
    if (this.record.temp === newTemp) {
      wx.showToast({ title: '体温未变化', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await db.updateRecord(this.record._id, this.record.date, this.record.temp, newTemp)
      wx.showToast({ title: '已更新', icon: 'success' })
      await this.load() // 刷新修改日志
    } catch (e) {
      console.error(e)
      const info = db.friendlyError(e)
      wx.showModal({ title: '保存失败', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 删除这条记录（误操作纠错）
  onDelete() {
    if (!this.record || this.data.saving) return
    wx.showModal({
      title: '删除这条记录',
      content: '将删除 ' + this.record.date + ' 的体温记录及其全部日志，不可恢复。确定删除？',
      confirmText: '删除',
      confirmColor: '#e53935',
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '删除中', mask: true })
        try {
          await db.deleteRecord(this.record._id, this.record.date)
          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 600)
        } catch (e) {
          wx.hideLoading()
          console.error(e)
          const info = db.friendlyError(e)
          wx.showModal({ title: '删除失败', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
        }
      }
    })
  }
})
