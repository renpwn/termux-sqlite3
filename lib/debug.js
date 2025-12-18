let enabled = false

function enableDebug(v = true) {
  enabled = v
}

function trace(sql) {
  if (enabled) {
    console.error("[SQL]", sql.trim())
  }
}

module.exports = { enableDebug, trace }