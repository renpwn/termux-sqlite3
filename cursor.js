const { detectChunkSize, estimateOptimalChunkSize } = require("./lib/memory")
const { bind } = require('./lib/binder')

class Cursor {
  constructor(stmt, options = {}) {
    this.stmt = stmt
    this.params = options.params || {}
    this.chunkSize = this._calculateInitialChunkSize(options)
    
    this.lastKey = null
    this.done = false
    this.buffer = []
    this.isFetching = false
    this.consumerWaiting = null
    
    // Performance metrics
    this.metrics = {
      rowsFetched: 0,
      chunksFetched: 0,
      startTime: Date.now(),
      lastFetchTime: null
    }
    
    // Adaptive chunking
    this.adaptiveMode = options.adaptive !== false
    this.minChunkSize = options.minChunk || 100
    this.maxChunkSize = options.maxChunk || 10000
    
    // Backpressure control
    this.highWaterMark = options.highWaterMark || 2
    this.lowWaterMark = options.lowWaterMark || 1
  }

  _calculateInitialChunkSize(options) {
    if (options.chunk === "auto") {
      return detectChunkSize()
    }
    
    if (options.chunk === "adaptive") {
      // Start with conservative chunk size
      return Math.min(500, detectChunkSize())
    }
    
    return options.chunk || 1000
  }

  async _fetchChunk() {
    if (this.done || this.isFetching) return
    
    this.isFetching = true
    const startTime = Date.now()
    
    try {
      let sql = this.stmt.sql
      
      // Apply cursor-based pagination if ORDER BY exists
      if (this.stmt.orderInfo && this.lastKey !== null) {
        const orderCol = this.stmt.orderInfo.columns[0]
        const operator = orderCol.direction === 'DESC' ? '<' : '>'
        
        if (this.stmt.originalSQL.toUpperCase().includes('WHERE')) {
          sql = sql.replace(
            /WHERE/i,
            `WHERE ${orderCol.name} ${operator} ${this._escapeValue(this.lastKey)} AND `
          )
        } else {
          const fromIndex = sql.toUpperCase().indexOf('FROM')
          if (fromIndex !== -1) {
            sql = sql.slice(0, fromIndex) + 
                  ` FROM (${this.stmt.originalSQL}) ` +
                  `WHERE ${orderCol.name} ${operator} ${this._escapeValue(this.lastKey)}`
          }
        }
      }
      
      // Apply LIMIT
      sql += ` LIMIT ${this.chunkSize}`
      
      const bounded = bind(sql, this.params)
      const rows = await this.stmt.engine.query(bounded)
      
      this.metrics.lastFetchTime = Date.now() - startTime
      this.metrics.chunksFetched++
      this.metrics.rowsFetched += rows.length
      
      if (rows.length === 0) {
        this.done = true
      
        // 🔥 FIX: lepaskan consumer yang menunggu
        if (this.consumerWaiting) {
          this.consumerWaiting.resolve()
          this.consumerWaiting = null
        }
      } else {
        // Update last key for next fetch
        const lastRow = rows[rows.length - 1]
        if (this.stmt.orderInfo) {
          const orderCol = this.stmt.orderInfo.columns[0]
          this.lastKey = lastRow[orderCol.name]
        }
        
        // Add to buffer
        this.buffer.push(...rows)
        
        // Adaptive chunk sizing
        if (this.adaptiveMode) {
          this._adjustChunkSize(rows.length)
        }
        
        // Resolve waiting consumer
        if (this.consumerWaiting) {
          this.consumerWaiting.resolve()
          this.consumerWaiting = null
        }
      }
    } catch (error) {
      console.error("[Cursor Fetch Error]", error)
      this.done = true
      
      if (this.consumerWaiting) {
        this.consumerWaiting.reject(error)
        this.consumerWaiting = null
      }
    } finally {
      this.isFetching = false
    }
  }

  _adjustChunkSize(fetchedRows) {
    const fetchTime = this.metrics.lastFetchTime
    const targetTime = 100 // Target fetch time in ms
    
    if (fetchTime < targetTime / 2 && fetchedRows === this.chunkSize) {
      // Too fast, increase chunk size
      this.chunkSize = Math.min(
        this.maxChunkSize,
        Math.floor(this.chunkSize * 1.5)
      )
    } else if (fetchTime > targetTime * 2) {
      // Too slow, decrease chunk size
      this.chunkSize = Math.max(
        this.minChunkSize,
        Math.floor(this.chunkSize * 0.7)
      )
    }
  }

  _escapeValue(value) {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? '1' : '0'
    return `'${String(value).replace(/'/g, "''")}'`
  }

  async _ensureBuffer() {
    // If buffer is below low water mark and not done, fetch more
    if (this.buffer.length < this.lowWaterMark && !this.done && !this.isFetching) {
      await this._fetchChunk()
    }
    
    // If buffer is empty but we expect more data, wait for fetch
    if (this.buffer.length === 0 && !this.done) {
      if (!this.isFetching) {
        await this._fetchChunk()
      } else {
        // Wait for current fetch to complete
        await new Promise((resolve, reject) => {
          this.consumerWaiting = { resolve, reject }
        })
      }
    }
    if (this.done && this.buffer.length === 0) {
      return
    }
  }

  async *iterate() {
    while (true) {
      await this._ensureBuffer()
  
      // ✅ FIX 3: EXIT CONDITION JELAS
      if (this.done && this.buffer.length === 0) {
        return
      }
  
      while (this.buffer.length > 0) {
        const row = this.buffer.shift()
  
        if (this.buffer.length >= this.highWaterMark && !this.isFetching) {
          this._fetchChunk().catch(console.error)
        }
  
        yield row
      }
    }
  }

  async toArray() {
    const results = []
    for await (const row of this.iterate()) {
      results.push(row)
    }
    return results
  }

  getMetrics() {
    const elapsed = Date.now() - this.metrics.startTime
    return {
      ...this.metrics,
      elapsedMs: elapsed,
      rowsPerSecond: this.metrics.rowsFetched / (elapsed / 1000),
      currentChunkSize: this.chunkSize
    }
  }
}

module.exports = Cursor