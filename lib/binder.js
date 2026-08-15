function escapeString(s) {
  if (typeof s !== 'string') return s
  return `'${s.replace(/'/g, "''")}'`
}

function bindValue(v) {
  if (v === null || v === undefined) return "NULL"
  
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "NULL"
    return String(v)
  }

  if (typeof v === "bigint") {
    return v.toString()
  }
  
  if (typeof v === "boolean") return v ? "1" : "0"

  if (Buffer.isBuffer(v)) {
    return `X'${v.toString('hex')}'`
  }
  
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

function splitSqlTokens(sql) {
  const chunks = []
  let i = 0
  const len = sql.length
  let currentChunk = ''
  
  while (i < len) {
    const char = sql[i]
    
    // Single quote string literal: '...'
    if (char === "'") {
      if (currentChunk) {
        chunks.push({ type: 'code', value: currentChunk })
        currentChunk = ''
      }
      let str = "'"
      i++
      while (i < len) {
        if (sql[i] === "'") {
          str += "'"
          if (i + 1 < len && sql[i + 1] === "'") {
            // Escaped quote ''
            str += "'"
            i += 2
            continue
          }
          i++
          break
        } else {
          str += sql[i]
          i++
        }
      }
      chunks.push({ type: 'literal', value: str })
      continue
    }
    
    // Line comment: -- ...
    if (char === '-' && i + 1 < len && sql[i + 1] === '-') {
      if (currentChunk) {
        chunks.push({ type: 'code', value: currentChunk })
        currentChunk = ''
      }
      let comment = '--'
      i += 2
      while (i < len && sql[i] !== '\n') {
        comment += sql[i]
        i++
      }
      chunks.push({ type: 'comment', value: comment })
      continue
    }
    
    // Block comment: /* ... */
    if (char === '/' && i + 1 < len && sql[i + 1] === '*') {
      if (currentChunk) {
        chunks.push({ type: 'code', value: currentChunk })
        currentChunk = ''
      }
      let comment = '/*'
      i += 2
      while (i < len) {
        if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          comment += '*/'
          i += 2
          break
        }
        comment += sql[i]
        i++
      }
      chunks.push({ type: 'comment', value: comment })
      continue
    }
    
    currentChunk += char
    i++
  }
  
  if (currentChunk) {
    chunks.push({ type: 'code', value: currentChunk })
  }
  
  return chunks
}

function bind(sql, params = {}) {
  const tokens = splitSqlTokens(sql)

  // Positional parameters (?)
  if (Array.isArray(params)) {
    let index = 0
    const result = tokens.map(tok => {
      if (tok.type !== 'code') return tok.value
      return tok.value.replace(/\?/g, () => {
        if (index >= params.length) {
          throw new Error("Not enough parameters for positional binds")
        }
        return bindValue(params[index++])
      })
    }).join('')

    return result
  }
  
  // Named parameters (:name)
  const paramKeys = Object.keys(params).sort((a, b) => b.length - a.length)
  for (const key of paramKeys) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid bind key: ${key}`)
    }
  }

  const result = tokens.map(tok => {
    if (tok.type !== 'code') return tok.value
    let chunk = tok.value
    for (const key of paramKeys) {
      const regex = new RegExp(`:${key}\\b`, "g")
      if (regex.test(chunk)) {
        chunk = chunk.replace(regex, bindValue(params[key]))
      }
    }
    return chunk
  }).join('')
  
  // Check for unbound parameters in code tokens
  const unboundTokens = splitSqlTokens(result)
  for (const tok of unboundTokens) {
    if (tok.type === 'code') {
      const unbound = tok.value.match(/:[A-Za-z_][A-Za-z0-9_]*\b/g)
      if (unbound) {
        throw new Error(`Unbound parameters: ${unbound.join(", ")}`)
      }
    }
  }
  
  return result
}

module.exports = { bind, bindValue, escapeString, splitSqlTokens }