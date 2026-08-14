// 云函数：login —— 获取当前微信用户的 openid，用于账号标识与数据归属标记
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  return { openid: OPENID || '' }
}
