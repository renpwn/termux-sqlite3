function escapeString(s) {
  if (typeof s !== 'string') return s
  return `'${s.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`
}

function bindValue(v) {
  if (v === null || v === undefined) return "NULL"
  
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "NULL"
    if (Number.isInteger(v)) return String(v)
    return String(v)
  }
  
  if (typeof v === "boolean") return v ? "1" : "0"
  
  if (typeof v === "string") return escapeString(v)
  
  if (Array.isArray(v)) {
    if (v.length === 0) return "(NULL)"
    return "(" + v.map(bindValue).join(", ") + ")"
  }
  
  if (typeof v === "object") {
    try {
      return escapeString(JSON.stringify(v))
    } catch {
      return "NULL"
    }
  }
  
  throw new Error(`Unsupported bind type: ${typeof v}`)
}

function bind(sql, params = {}) {
  // Check for positional parameters (?) as well
  if (Array.isArray(params)) {
    let index = 0
    return sql.replace(/\?/g, () => {
      if (index >= params.length) {
        throw new Error("Not enough parameters for positional binds")
      }
      return bindValue(params[index++])
    })
  }
  
  // Named parameters
  let result = sql
  const paramKeys = Object.keys(params).sort((a, b) => b.length - a.length)
  
  for (const key of paramKeys) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid bind key: ${key}`)
    }
    
    const regex = new RegExp(`:${key}\\b`, "g")
    if (regex.test(result)) {
      result = result.replace(regex, bindValue(params[key]))
    }
  }
  
  // Check for unbound parameters
  const unbound = result.match(/:[A-Za-z_][A-Za-z0-9_]*\b/g)
  if (unbound) {
    throw new Error(`Unbound parameters: ${unbound.join(", ")}`)
  }
  
  return result
}

module.exports = { bind, bindValue, escapeString }