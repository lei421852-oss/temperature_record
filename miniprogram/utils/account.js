// ==================== 账号工具 ====================
// 通过 login 云函数获取当前微信用户的 openid，用于：
//  1. 首页显示当前账号（掩码形式，如 oxYz****1234）
//  2. 给每条数据标记归属（records / logs / periods 都会写入 openid 字段）
//
// 数据隔离的根本保障是集合权限「仅创建者可读写」（云端强制，每个微信账号
// 只能读写自己创建的数据），openid 字段是额外的归属标记。
//
// 依赖 cloudfunctions/login 云函数，部署方法见 README。
// 未部署 login 时，getOpenid() 返回空字符串，不影响体温记录功能。

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

module.exports = { getOpenid, maskOpenid }
