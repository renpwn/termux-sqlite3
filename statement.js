const { bind } = require("./lib/binder")
const { explainSQL } = require("./lib/explain")
const Cursor = require("./cursor")

class Statement {
  constructor(engine, sql) {
    this.engine = engine
    this.sql = sql.trim()
    this.orderCols = this._detectOrder()
  }

  _detectOrder() {
    const m = this.sql.match(/order\s+by\s+(.+)$/i)
    if (!m) return null
    return m[1].split(",").map(s => s.trim().split(/\s+/)[0])
  }

  cursorKey(row) {
    if (!this.orderCols) return row.id
    return this.orderCols.length === 1
      ? row[this.orderCols[0]]
      : this.orderCols.map(k => row[k])
  }

  async _fetchChunk(params, lastKey, limit) {
    let sql = bind(this.sql, params)

    if (lastKey !== null && this.orderCols) {
      sql = `
        SELECT * FROM (${sql})
        WHERE ${this.orderCols[0]} > ${lastKey}
      `
    }

    sql += ` LIMIT ${limit}`
    return this.engine.query(sql)
  }

  async get(params = {}) {
    const rows = await this.engine.query(
      bind(this.sql + " LIMIT 1", params)
    )
    return rows[0] || null
  }

  async all(params = {}) {
    return this.engine.query(bind(this.sql, params))
  }

  iterate(options = {}) {
    return new Cursor(this, options).iterate()
  }

  explain() {
    return this.engine.query(explainSQL(this.sql))
  }
}

module.exports = Statement