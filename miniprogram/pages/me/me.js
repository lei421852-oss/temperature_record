const account = require('../../utils/account')

Page({
  data: {
    accountText: '',
    loggedIn: false,
    nickname: '微信用户',
    avatarUrl: ''
  },

  onShow() {
    // 底部导航栏：同步选中「我的」
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.refreshLogin()
  },

  // 刷新登录状态与个人信息
  refreshLogin() {
    const s = account.getLoginState()
    this.setData({
      loggedIn: !!s,
      nickname: (s && s.nickname) || '微信用户',
      avatarUrl: (s && s.avatarUrl) || ''
    })
    if (s && s.openid) {
      this.setData({ accountText: account.maskOpenid(s.openid) })
    } else {
      this.loadAccount()
    }
  },

  async loadAccount() {
    const oid = await account.getOpenid()
    this.setData({ accountText: account.maskOpenid(oid) })
  },

  // 点击个人信息卡片：未登录 → 登录；已登录 → 无操作（切换账号在菜单中）
  onCardTap() {
    if (!this.data.loggedIn) {
      this.onLoginTap()
    }
  },

  // 登录
  async onLoginTap() {
    try {
      await account.doLogin()
      this.refreshLogin()
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  // 退出登录：清除本地登录状态（真正的微信身份不变，数据仍属于当前微信账号）
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新登录才能显示昵称与账号信息；你已记录的数据仍保存在当前微信账号下。确定退出？',
      confirmText: '退出',
      confirmColor: '#e53935',
      success: (r) => {
        if (!r.confirm) return
        account.clearLoginState()
        this.setData({ loggedIn: false, nickname: '微信用户', avatarUrl: '' })
        wx.showToast({ title: '已退出登录', icon: 'none' })
      }
    })
  },

  // 功能入口（切换账号为占位，其余为占位）
  onFeatureTap(e) {
    const id = e.currentTarget.dataset.id
    if (id === 'logout') {
      this.onLogout()
      return
    }
    if (id === 'switch') {
      wx.showModal({
        title: '切换账号（占位）',
        content: '该功能开发中。小程序账号跟随微信账号：要切换账号，请在微信中切换登录的微信号。',
        showCancel: false
      })
      return
    }
    wx.showToast({ title: '功能开发中', icon: 'none' })
  }
})
