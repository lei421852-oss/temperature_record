const config = require('./config')

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('[体温记录] 当前基础库版本过低，请使用 2.2.3 以上版本以使用云能力')
      return
    }
    const cloudOptions = { traceUser: true }
    if (config.envId) {
      cloudOptions.env = config.envId
    }
    wx.cloud.init(cloudOptions)
    console.log('[体温记录] 云开发初始化完成' + (config.envId ? '（环境：' + config.envId + '）' : '（使用默认环境）'))
  }
})
