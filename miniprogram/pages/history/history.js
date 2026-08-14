const db = require('../../utils/db')
const { formatDateCN, formatDateTime } = require('../../utils/format')

Page({
  data: {
    records: [],
    loading: true,
    empty: false
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      const list = await db.getAllRecords()
      const records = list.map(r => ({
        _id: r._id,
        date: r.date,
        temp: r.temp,
        dateCN: formatDateCN(new Date(r.date + 'T00:00:00')),
        createdText: formatDateTime(r.createdAt) // 创建时间，精确到秒
      }))
      this.setData({ records, empty: records.length === 0, loading: false })
    } catch (e) {
      console.error(e)
      this.setData({ loading: false })
      const info = db.friendlyError(e)
      wx.showModal({ title: '云环境异常', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  }
})
