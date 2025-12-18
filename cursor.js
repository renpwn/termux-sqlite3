const { detectChunkSize } = require("./lib/memory")

class Cursor {
  constructor(stmt, options = {}) {
    this.stmt = stmt
    this.chunk =
      options.chunk === "auto"
        ? detectChunkSize()
        : options.chunk || 500

    this.lastKey = null
    this.done = false
  }

  async *iterate(params = {}) {
    while (!this.done) {
      const rows = await this.stmt._fetchChunk(
        params,
        this.lastKey,
        this.chunk
      )

      if (rows.length === 0) {
        this.done = true
        return
      }

      for (const row of rows) {
        this.lastKey = this.stmt.cursorKey(row)
        yield row
      }
    }
  }
}

module.exports = Cursor