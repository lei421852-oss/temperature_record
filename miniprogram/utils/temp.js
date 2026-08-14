// ==================== 体温滚动选择工具 ====================
// 生成 35.0 ~ 42.0、以 0.1 为单位的可选体温列表，并提供数值 <-> 下标转换。
const config = require('../config')

// 可选体温列表（字符串数组，如 ['35.0', '35.1', ..., '42.0']）
function tempOptions() {
  const count = Math.round((config.TEMP_MAX - config.TEMP_MIN) / config.TEMP_STEP) + 1
  const list = []
  for (let i = 0; i < count; i++) {
    list.push(tempValue(i).toFixed(1))
  }
  return list
}

// 数值 -> 在列表中的下标
function tempIndex(value) {
  return Math.round((value - config.TEMP_MIN) / config.TEMP_STEP)
}

// 下标 -> 数值（保留 1 位小数，避免浮点误差）
function tempValue(index) {
  return Math.round((config.TEMP_MIN + config.TEMP_STEP * index) * 10) / 10
}

module.exports = { tempOptions, tempIndex, tempValue }
