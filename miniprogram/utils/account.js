// ==================== 账号工具 ====================
// 通过 login 云函数获取当前微信用户的 openid；管理"登录状态"（保存在本地
// 存储，相当于网页的 cookie，避免每次打开都要求登录）。
//
// 数据隔离的根本保障是集合权限「仅创建者可读写」（云端强制，每个微信账号
// 只能读写自己创建的数据），openid 只是身份标识与归属标记。
//
// 依赖 cloudfunctions/login 云函数，部署方法见 README。
// 未部署 login 时，getOpenid() 返回空字符串，不影响体温记录功能。

const LOGIN_KEY = 'tl_login'

let cachedOpenid = null
let pending = null
let warned = false

// 获取当前用户 openid（带缓存；失败不缓存，下次自动重试）
function getOpenid() {
  if (cachedOpenid !== null) return Promise.resolve(cachedOpenid)
  if (pending) return pending
  pending = wx.cloud.callFunction({ name: 'login' })
    .then(res => {
      const oid = (res && res.result && res.result.openid) || ''
      cachedOpenid = oid
      return oid
    })
    .catch(e => {
      if (!warned) {
        warned = true
        console.error('[账号] 获取 openid 失败（请确认已部署 login 云函数，见 README）。数据隔离仍由集合权限保证：', e)
      }
      return ''
    })
    .finally(() => {
      pending = null
    })
  return pending
}

// 掩码显示：oxYz****1234
function maskOpenid(oid) {
  if (!oid) return '未获取到账号信息'
  if (oid.length <= 8) return oid.slice(0, 4) + '****'
  return oid.slice(0, 4) + '****' + oid.slice(-4)
}

// ---------- 登录状态（本地持久化，相当于 cookie）----------

// 读取登录状态：{ openid, nickname, avatarUrl, loginTime } 或 null
function getLoginState() {
  try {
    return wx.getStorageSync(LOGIN_KEY) || null
  } catch (e) {
    return null
  }
}

function setLoginState(profile) {
  try {
    wx.setStorageSync(LOGIN_KEY, profile)
  } catch (e) {
    console.error('[账号] 保存登录状态失败：', e)
  }
}

function clearLoginState() {
  try {
    wx.removeStorageSync(LOGIN_KEY)
  } catch (e) {
    // ignore
  }
}

// 执行登录：获取 openid + 尝试获取头像昵称，保存本地登录状态，
// 并同步一条记录到云端 users 集合（该集合未创建时静默跳过，不影响登录）
async function doLogin() {
  const oid = await getOpenid()
  let nickname = '微信用户'
  let avatarUrl = ''
  try {
    const res = await new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于展示你的昵称与头像',
        success: resolve,
        fail: reject
      })
    })
    if (res && res.userInfo) {
      nickname = res.userInfo.nickName || nickname
      avatarUrl = res.userInfo.avatarUrl || ''
    }
  } catch (e) {
    // 新版微信可能不再返回真实头像昵称，使用默认值
  }
  const profile = {
    openid: oid,
    nickname: nickname,
    avatarUrl: avatarUrl,
    loginTime: Date.now()
  }
  setLoginState(profile)
  // 同步到云端（可选集合 users，方便开发者在控制台查看登录记录）
  try {
    const col = wx.cloud.database().collection('users')
    const existing = await col.where({ openid: oid }).limit(1).get()
    if (existing.data.length) {
      await col.doc(existing.data[0]._id).update({
        data: { nickname: nickname, avatarUrl: avatarUrl, lastLoginTime: Date.now() }
      })
    } else {
      await col.add({
        data: {
          openid: oid,
          nickname: nickname,
          avatarUrl: avatarUrl,
          loginTime: Date.now(),
          lastLoginTime: Date.now()
        }
      })
    }
  } catch (e) {
    console.warn('[账号] 写入 users 集合失败（未创建该集合可忽略，登录状态已保存在本地）：', e)
  }
  return profile
}

module.exports = {
  getOpenid,
  maskOpenid,
  getLoginState,
  setLoginState,
  clearLoginState,
  doLogin
}
