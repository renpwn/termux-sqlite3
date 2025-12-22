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

  // ADD ON
  async clearTable(tableName, options = {}) {
    await this._ready()
    
    // Validasi tambahan
    if (!tableName) {
      throw new Error("Table name is required")
    }
    
    // Cek apakah tabel exists
    try {
      const tableInfo = await this.pragma(`table_info(${tableName})`)
      if (!tableInfo || tableInfo.length === 0) {
        throw new Error(`Table '${tableName}' does not exist`)
      }
    } catch (error) {
      if (error.message.includes('does not exist') || error.message.includes('no such table')) {
        throw new Error(`Table '${tableName}' does not exist`)
      }
    }
    
    return this.engine.clearTable(tableName, options)
  }

  async clearAllTables(options = {}) {
    await this._ready()
    
    // Konfirmasi keamanan (optional)
    const { skipConfirmation = false } = options
    
    if (!skipConfirmation && process.env.NODE_ENV !== 'test') {
      // Di production, mungkin ingin menambahkan konfirmasi
      console.warn('⚠️  WARNING: This will delete ALL data from ALL user tables!')
    }
    
    return this.engine.clearAllTables(options)
  }

  async truncateTable(tableName, options = {}) {
    // Alias untuk clearTable dengan reset autoincrement
    return this.clearTable(tableName, { ...options, resetAutoincrement: true })
  }

  async resetDatabase(options = {}) {
    // Reset lengkap: clear all + VACUUM + reset settings
    await this._ready()
    
    const result = await this.clearAllTables({
      ...options,
      resetAutoincrement: true,
      vacuumAfter: true,
      disableForeignKeys: true
    })
    
    // Reset pragma settings ke default
    await this.pragma('journal_mode', 'DELETE')
    await this.pragma('synchronous', 'FULL')
    await this.pragma('foreign_keys', 'ON')
    
    return {
      ...result,
      pragmaReset: true,
      message: 'Database completely reset to initial state'
    }
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