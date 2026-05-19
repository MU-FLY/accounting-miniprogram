// utils/util.js - 工具函数

/**
 * 格式化日期
 */
function formatDate(date, format) {
  format = format || 'YYYY-MM-DD'
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const result = format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
  return result
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString() + Math.random().toString().substr(2, 5)
}

/**
 * 格式化金额
 */
function formatAmount(amount) {
  return amount.toFixed(2)
}

module.exports = {
  formatDate: formatDate,
  generateId: generateId,
  formatAmount: formatAmount
}