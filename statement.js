const { bind } = require("./lib/binder")
const { explainSQL } = require("./lib/explain")
const Cursor = require("./cursor")

class Statement {
  constructor(engine, sql) {
    this.engine = engine
    this.originalSQL = sql.trim()
    this.sql = this.originalSQL
    this.orderInfo = this._parseOrderBy()
    this.hasLimit = this._detectLimit()
    this.tableInfo = null
  }

  _parseOrderBy() {
    // Remove comments first
    const sqlWithoutComments = this.sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim()
    
    // Find ORDER BY clause, handling nested parentheses
    let depth = 0
    let orderByIndex = -1
    
    for (let i = 0; i < sqlWithoutComments.length; i++) {
      const char = sqlWithoutComments[i]
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (depth === 0 && sqlWithoutComments.substring(i).toUpperCase().startsWith('ORDER BY')) {
        orderByIndex = i
        break
      }
    }
    
    if (orderByIndex === -1) return null
    
    const orderByClause = sqlWithoutComments.substring(orderByIndex + 8).trim()
    
    // Parse columns with direction
    const columns = []
    let current = ''
    let inQuotes = false
    let quoteChar = null
    
    for (let i = 0; i < orderByClause.length; i++) {
      const char = orderByClause[i]
      
      if ((char === "'" || char === '"') && (i === 0 || orderByClause[i-1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
        }
      }
      
      if (!inQuotes && char === ',') {
        const parsed = this._parseOrderColumn(current.trim())
        if (parsed) columns.push(parsed)
        current = ''
      } else {
        current += char
      }
    }
    
    if (current.trim()) {
      const parsed = this._parseOrderColumn(current.trim())
      if (parsed) columns.push(parsed)
    }
    
    if (columns.length === 0) return null
    
    return {
      raw: orderByClause.split('LIMIT')[0].trim(),
      columns,
      isMultiColumn: columns.length > 1
    }
  }

  _parseOrderColumn(columnStr) {
    const parts = columnStr.split(/\s+/)
    if (parts.length === 0) return null
    
    const name = parts[0].replace(/^["']|["']$/g, '')
    const direction = parts[1] ? parts[1].toUpperCase() : 'ASC'
    
    return {
      name,
      direction: direction === 'DESC' ? 'DESC' : 'ASC',
      collate: parts[2] === 'COLLATE' ? parts[3] : null
    }
  }

  _detectLimit() {
    const limitMatch = this.sql.toUpperCase().match(/LIMIT\s+(\d+)(?:\s*,\s*(\d+))?(?:\s+OFFSET\s+(\d+))?$/i)
    if (!limitMatch) return null
    
    return {
      limit: parseInt(limitMatch[1]) || null,
      offset: parseInt(limitMatch[2] || limitMatch[3] || 0)
    }
  }

  async get(params = {}) {
    const bounded = bind(this.originalSQL + " LIMIT 1", params)
    const rows = await this.engine.query(bounded)
    return rows[0] || null
  }

  async all(params = {}) {
    const bounded = bind(this.originalSQL, params)
    return this.engine.query(bounded)
  }

  async run(params = {}) {
    const bounded = bind(this.originalSQL, params)
    await this.engine.exec(bounded)
    
    // Try to get changes count
    try {
      const changes = await this.engine.query("SELECT changes() as changes, last_insert_rowid() as lastId")
      return {
        changes: changes[0]?.changes || 0,
        lastInsertRowid: changes[0]?.lastId || 0
      }
    } catch {
      return { changes: 0, lastInsertRowid: 0 }
    }
  }

  iterate(options = {}) {
    return new Cursor(this, options).iterate()
  }

  async explain(params = {}) {
    const bounded = bind(this.originalSQL, params)
    return this.engine.query(explainSQL(bounded))
  }

  async columns() {
    if (!this.tableInfo) {
      // Extract table name from simple queries
      const tableMatch = this.originalSQL.match(/FROM\s+(["`]?)(\w+)\1/i)
      if (tableMatch) {
        const tableName = tableMatch[2]
        try {
          const pragma = await this.engine.query(`PRAGMA table_info(${tableName})`)
          this.tableInfo = pragma.map(col => ({
            name: col.name,
            type: col.type,
            notnull: col.notnull === 1,
            defaultValue: col.dflt_value,
            pk: col.pk === 1
          }))
        } catch {
          this.tableInfo = []
        }
      }
    }
    return this.tableInfo || []
  }
}

module.exports = Statement