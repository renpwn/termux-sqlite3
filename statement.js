const { bind } = require("./lib/binder")
const { explainSQL } = require("./lib/explain")
const Cursor = require("./cursor")

class Statement {
  constructor(engine, sql) {
    this.engine = engine
    this.sql = sql.trim()
    this.boundSQL = null
    this.orderInfo = this._parseOrderBy()
  }

  _parseOrderBy() {
    const orderMatch = this.sql.match(/ORDER\s+BY\s+(.+?)(?:\s+(ASC|DESC))?(?:\s*,\s*(.+))?$/i)
    if (!orderMatch) return null
    
    const columns = []
    const raw = orderMatch[1] + (orderMatch[2] ? ` ${orderMatch[2]}` : '')
    
    // Parse multiple columns
    const columnParts = raw.split(',').map(s => s.trim())
    
    columnParts.forEach(part => {
      const [col, direction] = part.split(/\s+/)
      columns.push({
        name: col,
        direction: (direction || 'ASC').toUpperCase()
      })
    })
    
    return {
      raw,
      columns,
      isMultiColumn: columns.length > 1
    }
  }

  getCursorKey(row) {
    if (!this.orderInfo) {
      // Try to use rowid or primary key as fallback
      return row.rowid || row.id || JSON.stringify(row)
    }
    
    if (this.orderInfo.isMultiColumn) {
      return this.orderInfo.columns.map(col => row[col.name])
    }
    
    return row[this.orderInfo.columns[0].name]
  }

  buildPaginationSQL(baseSQL, lastKey, limit) {
    if (!this.orderInfo || !lastKey) {
      return `${baseSQL} LIMIT ${limit}`
    }
    
    const mainCol = this.orderInfo.columns[0]
    const operator = mainCol.direction === 'DESC' ? '<' : '>'
    
    if (this.orderInfo.isMultiColumn) {
      // Complex pagination for multiple columns
      const conditions = []
      let paramIndex = 0
      
      for (let i = 0; i < this.orderInfo.columns.length; i++) {
        const col = this.orderInfo.columns[i]
        const keyPart = Array.isArray(lastKey) ? lastKey[i] : lastKey
        
        if (i === this.orderInfo.columns.length - 1) {
          conditions.push(`${col.name} ${operator} ${this._valueToSQL(keyPart)}`)
        } else {
          const nextKey = Array.isArray(lastKey) ? lastKey[i + 1] : null
          conditions.push(`${col.name} > ${this._valueToSQL(keyPart)}`)
        }
      }
      
      return `
        SELECT * FROM (${baseSQL}) 
        WHERE ${conditions.join(' OR ')}
        ORDER BY ${this.orderInfo.raw}
        LIMIT ${limit}
      `
    } else {
      // Simple pagination for single column
      return `
        SELECT * FROM (${baseSQL})
        WHERE ${mainCol.name} ${operator} ${this._valueToSQL(lastKey)}
        ORDER BY ${this.orderInfo.raw}
        LIMIT ${limit}
      `
    }
  }

  _valueToSQL(value) {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? '1' : '0'
    return `'${String(value).replace(/'/g, "''")}'`
  }

  async get(params = {}) {
    const bounded = bind(this.sql + " LIMIT 1", params)
    const rows = await this.engine.query(bounded)
    return rows[0] || null
  }

  async all(params = {}) {
    const bounded = bind(this.sql, params)
    return this.engine.query(bounded)
  }

  async run(params = {}) {
    const bounded = bind(this.sql, params)
    await this.engine.exec(bounded)
    
    // Get affected rows
    const changes = await this.engine.query("SELECT changes() as changes")
    return { changes: changes[0]?.changes || 0 }
  }

  iterate(options = {}) {
    return new Cursor(this, options).iterate()
  }

  explain(params = {}) {
    const bounded = bind(this.sql, params)
    return this.engine.query(explainSQL(bounded))
  }
}

module.exports = Statement