// ==================== 云数据库封装 ====================
// 所有数据操作都集中在这里，方便以后扩展（如迁移到云函数、增加统计等）。
//
// 数据集合说明：
//  - records：体温记录，一天一条。字段：date(YYYY-MM-DD)、temp、createdAt(ms)、updatedAt(ms)
//  - logs：日志表，创建/修改都记一行。字段：recordDate、action(create|update)、oldTemp、newTemp、time(ms)
//  - periods：月经周期。字段：startDate(YYYY-MM-DD)、endDate(YYYY-MM-DD，'' 表示进行中)、createdAt(ms)、updatedAt(ms)
//
// 账号隔离：集合权限设为「仅创建者可读写」后，云端强制每个微信账号只能读写
// 自己创建的数据（这是数据相互独立的根本保障）。此外每条数据写入时还会带上
// openid 字段标记归属（云数据库同时自动写入 _openid）。

const account = require('./account')

function db() {
  return wx.cloud.database()
}

const recordsCol = () => db().collection('records')
const logsCol = () => db().collection('logs')
const periodsCol = () => db().collection('periods')

// 单次拉取上限（小程序端每页最多 20 条）
const PAGE_SIZE = 20
// 安全上限（约 3 年每天一条）
const MAX_RECORDS = 1000

// 把云开发报错翻译成便于排查的中文提示
// 用法：const info = friendlyError(e) → info.hint（建议）+ info.raw（原始错误）
function friendlyError(e) {
  const raw = (e && (e.errMsg || e.message)) || String(e || '未知错误')
  const errCode = e && e.errCode

  if (typeof wx !== 'undefined' && !wx.cloud) {
    return { raw, hint: '基础库版本过低：请在「详情 → 本地设置」中把调试基础库调到 2.2.3 以上（建议最新稳定版）。' }
  }
  if (raw.indexOf('云开发') > -1 || raw.indexOf('云托管') > -1 || raw.indexOf('没有权限') > -1) {
    return { raw, hint: '当前小程序还没开通云开发：请在微信开发者工具顶部工具栏点击「云开发」按钮 → 开通 → 创建环境（必须使用自己注册的真实 AppID，测试号无法开通）。' }
  }
  if (errCode === -501000 || raw.indexOf('invalid scope') > -1) {
    return { raw, hint: '云开发不可用：请确认使用的是自己注册的真实 AppID（测试号/游客 AppID 不支持云开发），并在开发者工具中已开通云开发。' }
  }
  if (errCode === -502005 || raw.indexOf('collection not exist') > -1 || raw.indexOf('DATABASE_COLLECTION_NOT_EXIST') > -1) {
    return { raw, hint: '数据库集合不存在：请在「云开发控制台 → 数据库」中新建 records、logs、periods 三个集合。' }
  }
  if (errCode === -502004 || raw.indexOf('document not exist') > -1 || raw.indexOf('DOCUMENT_NOT_EXIST') > -1) {
    return { raw, hint: '这条记录不存在：可能已被删除，请返回列表刷新后重试。' }
  }
  if (raw.indexOf('env') > -1 && (raw.indexOf('not exist') > -1 || raw.indexOf('invalid') > -1 || raw.indexOf('not found') > -1)) {
    return { raw, hint: '云开发环境不存在或环境 ID 填错：请核对 miniprogram/config.js 里的 envId 与云开发控制台中的环境 ID 是否一致。' }
  }
  if (raw.indexOf('login') > -1 || raw.indexOf('not login') > -1 || raw.indexOf('unauthorized') > -1) {
    return { raw, hint: '未登录：请在开发者工具右上角登录微信账号后再试。' }
  }
  if (raw.indexOf('permission') > -1 || raw.indexOf('denied') > -1) {
    return { raw, hint: '数据库权限不足：请检查 records / logs / periods 集合的权限设置（建议「仅创建者可读写」）。' }
  }
  if (raw.indexOf('cloud') > -1 && (raw.indexOf('init') > -1 || raw.indexOf('not init') > -1)) {
    return { raw, hint: '云开发未初始化：请确认已开通云开发，并重新编译后重试。' }
  }
  return { raw, hint: '云开发调用失败（详见下方原始错误）。常见原因：未用真实 AppID、未开通云开发、环境 ID 错误、未创建集合。' }
}

// 获取某一天的记录，没有则返回 null
async function getRecordByDate(date) {
  const res = await recordsCol().where({ date }).limit(1).get()
  return res.data.length ? res.data[0] : null
}

// 按 id 获取记录
async function getRecordById(id) {
  const res = await recordsCol().doc(id).get()
  return res.data
}

// 获取最近一条记录（按日期倒序），没有则返回 null
async function getLatestRecord() {
  const res = await recordsCol().orderBy('date', 'desc').limit(1).get()
  return res.data.length ? res.data[0] : null
}

// 获取全部记录（按日期倒序，自动分页）
async function getAllRecords() {
  const col = recordsCol().orderBy('date', 'desc')
  let all = []
  let skip = 0
  for (;;) {
    const res = await col.skip(skip).limit(PAGE_SIZE).get()
    all = all.concat(res.data)
    if (res.data.length < PAGE_SIZE) break
    skip += PAGE_SIZE
    if (skip >= MAX_RECORDS) break
  }
  return all
}

// 获取某一天的全部日志（按时间倒序，最新的在前）
async function getLogsByDate(date) {
  const res = await logsCol()
    .where({ recordDate: date })
    .orderBy('time', 'desc')
    .limit(100)
    .get()
  return res.data
}

// 新建记录，并写入一条创建日志（带账号归属标记）
async function createRecord(date, temp) {
  const now = Date.now()
  const openid = await account.getOpenid()
  const recordData = { date, temp, createdAt: now, updatedAt: now }
  const logData = {
    recordDate: date,
    action: 'create',
    oldTemp: null,
    newTemp: temp,
    time: now
  }
  if (openid) {
    recordData.openid = openid
    logData.openid = openid
  }
  const recordRes = await recordsCol().add({ data: recordData })
  await logsCol().add({ data: logData })
  return recordRes._id
}

// 更新记录体温，并写入一条修改日志（带账号归属标记）
async function updateRecord(recordId, date, oldTemp, newTemp) {
  const now = Date.now()
  const openid = await account.getOpenid()
  await recordsCol().doc(recordId).update({
    data: { temp: newTemp, updatedAt: now }
  })
  const logData = {
    recordDate: date,
    action: 'update',
    oldTemp: oldTemp,
    newTemp: newTemp,
    time: now
  }
  if (openid) logData.openid = openid
  await logsCol().add({ data: logData })
}

// -------------------- 月经周期 --------------------

// 获取进行中的月经周期（还没有结束日期），没有则返回 null
async function getOngoingPeriod() {
  const res = await periodsCol()
    .where({ endDate: '' })
    .orderBy('startDate', 'desc')
    .limit(1)
    .get()
  return res.data.length ? res.data[0] : null
}

// 获取全部月经周期（按开始日期倒序）
async function getPeriods() {
  const res = await periodsCol().orderBy('startDate', 'desc').limit(500).get()
  return res.data
}

// 记录月经开始（带账号归属标记），返回周期 id
async function startPeriod(date) {
  const now = Date.now()
  const openid = await account.getOpenid()
  const data = { startDate: date, endDate: '', createdAt: now, updatedAt: now }
  if (openid) data.openid = openid
  const res = await periodsCol().add({ data })
  return res._id
}

// 结束月经（写入结束日期）
async function endPeriod(periodId, date) {
  await periodsCol().doc(periodId).update({
    data: { endDate: date, updatedAt: Date.now() }
  })
}

module.exports = {
  friendlyError,
  getRecordByDate,
  getRecordById,
  getLatestRecord,
  getAllRecords,
  getLogsByDate,
  createRecord,
  updateRecord,
  getOngoingPeriod,
  getPeriods,
  startPeriod,
  endPeriod
}
