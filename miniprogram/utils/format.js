// ==================== 时间格式化工具 ====================

// 补零
function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

// Date -> 'YYYY-MM-DD'（本地时区，精确到日）
function formatDate(d) {
  d = d || new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

// 时间戳 -> 'YYYY-MM-DD HH:mm:ss'（精确到秒）
function formatDateTime(ts) {
  const d = new Date(ts)
  return formatDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

// Date -> 'YYYY年M月D日 周X'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
function formatDateCN(d) {
  d = d || new Date()
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + WEEK[d.getDay()]
}

module.exports = {
  formatDate,
  formatDateTime,
  formatDateCN
}
