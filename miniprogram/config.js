// ==================== 全局配置 ====================

// 云开发环境 ID：在微信开发者工具 -> 云开发 -> 设置 中查看
// 留空字符串表示使用默认环境（若只有一个环境可留空）
const envId = 'cloud1-d9gk1620de234d313'

// 体温滑条相关默认值
const TEMP_MIN = 35     // 滑条最小值（℃）
const TEMP_MAX = 42     // 滑条最大值（℃）
const TEMP_STEP = 0.1   // 滑条步长（最小单位）
const DEFAULT_TEMP = 36.5 // 无历史记录时的默认体温（人体常见体温）

module.exports = {
  envId,
  TEMP_MIN,
  TEMP_MAX,
  TEMP_STEP,
  DEFAULT_TEMP
}
