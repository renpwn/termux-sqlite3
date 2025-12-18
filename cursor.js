const { detectChunkSize } = require("./lib/memory")

class Cursor {
  constructor(stmt, options = {}) {
    this.stmt = stmt
    this.params = options.params || {}
    this.chunkSize = options.chunk === "auto" 
      ? detectChunkSize() 
      : (options.chunk || 500)
    
    this.lastKey = null
    this.offset = 0
    this.hasOrderBy = !!stmt.orderInfo
    this.isDone = false
    this.currentChunk = []
    this.chunkIndex = 0
  }

  async _fetchNextChunk() {
    if (this.isDone) return []
    
    try {
      const sql = this.stmt.buildPaginationSQL(
        this.stmt.sql,
        this.lastKey,
        this.chunkSize
      )
      
      const bounded = this.stmt.bind(sql, this.params)
      const rows = await this.stmt.engine.query(bounded)
      
      if (rows.length === 0) {
        this.isDone = true
        return []
      }
      
      // Update last key for next pagination
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1]
        this.lastKey = this.stmt.getCursorKey(lastRow)
      }
      
      return rows
    } catch (error) {
      console.error("[Cursor Error]", error)
      this.isDone = true
      throw error
    }
  }

  async *iterate() {
    while (!this.isDone) {
      if (this.chunkIndex >= this.currentChunk.length) {
        this.currentChunk = await this._fetchNextChunk()
        this.chunkIndex = 0
        
        if (this.currentChunk.length === 0) {
          break
        }
      }
      
      while (this.chunkIndex < this.currentChunk.length) {
        yield this.currentChunk[this.chunkIndex]
        this.chunkIndex++
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
}

module.exports = Cursor