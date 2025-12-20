const Engine = require("./engine")
const Statement = require("./statement")
const transaction = require("./transaction")

class Database {
  constructor(filename, options = {}) {
    this.filename = filename
    this.options = options
    this.engine = new Engine(filename, options)
    this.statements = new Map() // Cache for prepared statements
    
    // 🔥 INTERNAL INIT (PRAGMA DI LIBRARY)
    this._initPromise = this._initPragmas()
  
    // Event forwarding
    this.engine.on('error', (err) => {
      if (this.listeners('error').length > 0) {
        this.emit('error', err)
      }
    })
  }
  
  async _initPragmas() {
    // Pastikan hanya sekali
    if (this._pragmasInitialized) return
    this._pragmasInitialized = true
  
    // ⚠️ JANGAN exec di engine init
    await this.engine.pragma("journal_mode = WAL")
    await this.engine.pragma("synchronous = NORMAL")
    await this.engine.pragma("foreign_keys = ON")
  }
  
  async _ready() {
    if (this._initPromise) {
      await this._initPromise
      this._initPromise = null
    }
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
    await this._ready()
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
    const engine = this.engine
    const ready = this._ready.bind(this)
  
    return async (...args) => {
      await ready()
      return transaction(engine, () => fn(...args), options)
    }
  }

  /*transaction(fn, options) {
    //return transaction(this.engine, fn, options)
    return async(...args) => {
      await this._ready()
      const trx = transaction(this.engine, fn, options)
      return trx(...args)
    }
  }
  
  /*transaction(fn, options) {
    const engine = this.engine
    const ready = this._ready.bind(this)
  
    return async (...args) => {
      await ready()
  
      // ⬇️ transaction() SUDAH EKSEKUSI
      return transaction(engine, async () => {
        return fn(...args)
      }, options)
    }
  }*/
  
  transactionold(fn, options) {
    if (fn.constructor.name === 'AsyncFunction') {
      throw new Error(
        'transaction callback MUST NOT be async'
      )
    }
  
    const engine = this.engine
    const ready = this._ready.bind(this)
  
    // 🔑 BUAT TRANSACTION FUNCTION SEKALI
    const trx = transaction(engine, fn, options)
  
    // 🔑 RETURN FUNCTION (API CONTRACT)
    return async (...args) => {
      await ready()
      return trx(...args)
    }
  }
  
  transactionoldz(fn, options) {
    if (fn.constructor.name === 'AsyncFunction') {
      throw new Error(
        'transaction callback MUST NOT be async'
      )
    }
  
    const engine = this.engine
    const ready = this._ready.bind(this)
  
    // ⬇️ RETURN EXECUTOR FUNCTION
    return async (...args) => {
      await ready()
  
      // 🔑 PANGGIL transaction SETIAP EKSEKUSI
      const trx = transaction(engine, fn, options)
  
      if (typeof trx !== 'function') {
        throw new TypeError(
          'Internal error: transaction() did not return a function'
        )
      }
  
      return trx(...args)
    }
  }

  async pragma(name, value) {
    await this._ready()
    const sql = value !== undefined ? `PRAGMA ${name} = ${value}` : `PRAGMA ${name}`
    const result = await this.engine.query(sql)
    return result.length === 1 ? result[0] : result
  }

  async backup(targetFilename) {
    await this._ready()
    // Simple backup using .dump command
    await this.engine.exec(`.backup ${targetFilename}`)
    return true
  }

  async vacuum() {
    await this._ready()
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
    await this._ready()
    const stmt = this.prepare(sql)
    return stmt.get(params)
  }

  async all(sql, params) {
    await this._ready()
    const stmt = this.prepare(sql)
    return stmt.all(params)
  }

  async run(sql, params) {
    await this._ready()
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