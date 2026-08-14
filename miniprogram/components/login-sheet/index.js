// 登录面板：头像昵称填写（微信官方"头像昵称填写能力"）
// 触发 login 事件：{ nickname, avatarUrl }
Component({
  properties: {
    visible: { type: Boolean, value: false }
  },

  data: {
    avatarUrl: '',
    nickname: ''
  },

  methods: {
    onChooseAvatar(e) {
      this.setData({ avatarUrl: e.detail.avatarUrl })
    },

    onNicknameInput(e) {
      this.setData({ nickname: e.detail.value })
    },

    onConfirm() {
      const nickname = (this.data.nickname || '').trim() || '微信用户'
      this.triggerEvent('login', { nickname: nickname, avatarUrl: this.data.avatarUrl })
    },

    onClose() {
      this.triggerEvent('close')
    },

    // 阻止点击面板内容时关闭
    noop() {}
  }
})
