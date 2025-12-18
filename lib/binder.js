function escapeString(s) {
  return `'${s.replace(/'/g, "''")}'`
}

function bindValue(v) {
  if (v === null || v === undefined) return "NULL"

  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error("Invalid number bind")
    }
    return String(v)
  }

  if (typeof v === "boolean") return v ? "1" : "0"

  if (typeof v === "string") return escapeString(v)

  if (Array.isArray(v)) {
    if (v.length === 0) return "(NULL)"
    return "(" + v.map(bindValue).join(", ") + ")"
  }

  throw new Error("Unsupported bind type")
}

function bind(sql, params = {}) {
  let out = sql
  for (const k of Object.keys(params)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
      throw new Error("Invalid bind key: " + k)
    }
    out = out.replace(
      new RegExp(":" + k + "\\b", "g"),
      bindValue(params[k])
    )
  }
  return out
}

module.exports = { bind }