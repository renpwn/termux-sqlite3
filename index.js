const Engine = require("./engine")
const Statement = require("./statement")
const transaction = require("./transaction")

class Database {
  constructor(filename, options = {}) {
    this.filename = filename
    this.options = options
    this.engine = new Engine(filename, options)
    this.statements = new Map() // Cache for prepared statements
    
    // Event forwarding
    this.engine.on('error', (err) => {
      if (this.listeners('error').length > 0) {
        this.emit('error', err)
      }
    })
  }

  // Inherit EventEmitter
  on(event, listener) {
    this.engine.on(event, listener)
    return this
  }

  off(event, listener) {
    this.engine.off(event, listener)
    return this
  }

  emit(event, ...args) {
    return this.engine.emit(event, ...args)
  }

  async exec(sql) {
    return this.engine.exec(sql)
  }

  prepare(sql) {
    // Cache prepared statements
    const cacheKey = sql.trim()
    if (this.statements.has(cacheKey)) {
      return this.statements.get(cacheKey)
    }
    
    const stmt = new Statement(this.engine, sql)
    this.statements.set(cacheKey, stmt)
    return stmt
  }

  transaction(fn, options) {
    return transaction(this.engine, fn, options)
  }

  async pragma(name, value) {
    const sql = value !== undefined ? `PRAGMA ${name} = ${value}` : `PRAGMA ${name}`
    const result = await this.engine.query(sql)
    return result.length === 1 ? result[0] : result
  }

  async backup(targetFilename) {
    // Simple backup using .dump command
    await this.engine.exec(`.backup ${targetFilename}`)
    return true
  }

  async vacuum() {
    return this.engine.vacuum()
  }

  async checkpoint(mode = 'PASSIVE') {
    await this.exec(`PRAGMA wal_checkpoint(${mode})`)
  }

  async close() {
    // Clear statement cache
    this.statements.clear()
    // Close engine
    await this.engine.close()
  }

  // Helper methods
  async get(sql, params) {
    const stmt = this.prepare(sql)
    return stmt.get(params)
  }

  async all(sql, params) {
    const stmt = this.prepare(sql)
    return stmt.all(params)
  }

  async run(sql, params) {
    const stmt = this.prepare(sql)
    return stmt.run(params)
  }

  // Table operations
  async tableInfo(tableName) {
    return this.pragma(`table_info(${tableName})`)
  }

  async indexInfo(tableName) {
    return this.pragma(`index_info(${tableName})`)
  }

  async foreignKeyList(tableName) {
    return this.pragma(`foreign_key_list(${tableName})`)
  }
}

// Mixin EventEmitter
require('events').EventEmitter.call(Database.prototype)
Object.setPrototypeOf(Database.prototype, require('events').EventEmitter.prototype)
Object.setPrototypeOf(Database, require('events').EventEmitter)

module.exports = Database