const account = require('../../utils/account')

Page({
  data: {
    accountText: ''
  },

  onShow() {
    // 底部导航栏：同步选中「我的」
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadAccount()
  },

  async loadAccount() {
    const oid = await account.getOpenid()
    this.setData({ accountText: account.maskOpenid(oid) })
  },

  // 占位功能：后续版本再实现
  onFeatureTap(e) {
    const id = e.currentTarget.dataset.id
    if (id === 'logout') {
      wx.showModal({
        title: '退出登录（占位）',
        content: '该功能开发中。小程序账号跟随微信账号，目前数据已按微信账号独立保存。',
        showCancel: false
      })
      return
    }
    wx.showToast({ title: '功能开发中', icon: 'none' })
  }
})
