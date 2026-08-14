// 自定义底部导航栏（原生 tabBar 不支持调整字体大小，改用自定义组件）
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '记录' },
      { pagePath: '/pages/me/me', text: '我的' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const path = this.data.list[index].pagePath
      wx.switchTab({ url: path })
    }
  }
})
