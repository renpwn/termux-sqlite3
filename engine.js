const { spawn } = require("child_process")
const { trace } = require("./lib/debug")
const EventEmitter = require("events")

class Engine extends EventEmitter {
  constructor(filename, options = {}) {
    super()
    this.filename = filename
    this.options = {
      timeout: 5000,
      maxRetries: 3,
      poolSize: 1,
      busyTimeout: 5000,
      ...options
    }
    
    this.processPool = []
    this.queue = []
    this.activeQueries = 0
    this.isClosing = false
    
    // Initialize process pool
    this._initPool()
  }

  async _initPool() {
    for (let i = 0; i < this.options.poolSize; i++) {
      await this._createProcess()
    }
  }

  async _createProcess() {
    return new Promise((resolve, reject) => {
      const proc = spawn("sqlite3", ["-json", this.filename], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, SQLITE_TMPDIR: "/data/data/com.termux/files/usr/tmp" }
      })
      
      const processObj = {
        proc,
        isBusy: true,
        buffer: "",
        responseBuffer: "",   // ⬅️ TAMBAH INI
        resolve: null,
        reject: null,
        currentQuery: null,
        lastUsed: Date.now()
      }
  
      // === INIT TIMEOUT (DITANYAKAN KAMU) ===
      const initTimeout = setTimeout(() => {
        this._restartProcess(processObj)
        reject(new Error("Process initialization timeout"))
      }, 5000)
  
      // resolve akan dipanggil saat __READY__ diterima
      processObj.resolve = () => {
        clearTimeout(initTimeout)
        processObj.isBusy = false
        processObj.resolve = null
        processObj.reject = null
        processObj.lastUsed = Date.now()
  
        this.processPool.push(processObj)
        resolve(processObj)
      }
  
      proc.stdout.on("data", (chunk) => {
        processObj.buffer += chunk.toString()
        this._processBuffer(processObj)
      })
  
      proc.stderr.on("data", (data) => {
        const error = data.toString().trim()
        if (error && !error.includes("Warning:")) {
          this.emit("error", new Error(`SQLite: ${error}`))
        }
      })
  
      proc.on("error", (err) => {
        clearTimeout(initTimeout)
        this.emit("error", err)
        reject(err)
      })
  
      proc.on("exit", (code) => {
        if (code !== 0 && !this.isClosing) {
          this.emit("error", new Error(`Process exited with code ${code}`))
        }
      })
  
      // === KIRIM INIT COMMAND ===
      proc.stdin.write(`.timeout ${this.options.busyTimeout}\n`)
      proc.stdin.write(".mode json\n")
      proc.stdin.write(".headers off\n")
  
      // ⬅️ SENTINEL PALING PENTING
      proc.stdin.write(".print __READY__\n")
    })
  }

  _processBuffer(processObj) {
    const lines = processObj.buffer.split('\n')
  
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
  
      // READY sentinel (init)
      if (line.trim() === "__READY__") {
        if (processObj.resolve) {
          processObj.resolve()
        }
        continue
      }
  
      // END sentinel (query selesai)
      if (line.trim() === "__END__") {
        const raw = processObj.responseBuffer.trim()
        processObj.responseBuffer = ""
  
        if (processObj.resolve) {
          try {
            const result = raw
              ? JSON.parse(raw)
              : []
  
            processObj.resolve(Array.isArray(result) ? result : [result])
          } catch (err) {
            processObj.reject?.(
              new Error(`JSON Parse Error: ${err.message}, Data: ${raw}`)
            )
          }
  
          processObj.resolve = null
          processObj.reject = null
          processObj.currentQuery = null
          processObj.isBusy = false
          processObj.lastUsed = Date.now()
        }
        continue
      }
  
      // Kumpulkan output query
      processObj.responseBuffer += line + "\n"
    }
  
    // simpan sisa buffer
    processObj.buffer = lines[lines.length - 1]
  }

  async _getAvailableProcess() {
    // Find idle process
    let process = this.processPool.find(p => !p.isBusy)
    
    if (!process && this.processPool.length < this.options.poolSize) {
      // Create new process if under pool limit
      process = await this._createProcess()
    }
    
    return process
  }

  async _executeWithRetry(sql, retries = 0) {
    try {
      const process = await this._getAvailableProcess()
      if (!process) {
        throw new Error("No available SQLite process")
      }

      return new Promise((resolve, reject) => {
        // Set timeout for query
        const timeoutId = setTimeout(() => {
          if (process.reject) {
            process.reject(new Error(`Query timeout after ${this.options.timeout}ms`))
          }
          this._restartProcess(process)
        }, this.options.timeout)

        process.isBusy = true
        process.currentQuery = sql
        process.resolve = (data) => {
          clearTimeout(timeoutId)
          resolve(data)
        }
        process.reject = (err) => {
          clearTimeout(timeoutId)
          reject(err)
        }

        trace(sql)
        process.proc.stdin.write(sql + ";\n.print __END__\n")
      })
    } catch (error) {
      if (retries < this.options.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * (retries + 1)))
        return this._executeWithRetry(sql, retries + 1)
      }
      throw error
    }
  }

  async query(sql) {
    if (this.isClosing) {
      throw new Error("Database is closing")
    }
    
    return this._executeWithRetry(sql)
  }

  async exec(sql) {
    if (this.isClosing) {
      throw new Error("Database is closing")
    }
    
    await this._executeWithRetry(sql)
    return { changes: 0 } // SQLite CLI doesn't return changes count
  }

  async vacuum() {
    return this.exec("VACUUM")
  }

  
  
  async clearAllTables() {
    if (this.isClosing) {
      throw new Error("Database is closing")
    }

    // Ambil semua tabel user
    const tables = await this.query(`
      SELECT name
      FROM sqlite_master
      WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
    `)

    if (!tables.length) return

    // Bungkus transaction (WAJIB)
    let sql = "BEGIN;\n"

    for (const { name } of tables) {
      sql += `DELETE FROM "${name}";\n`
    }

    // Reset AUTOINCREMENT (opsional tapi recommended)
    sql += "DELETE FROM sqlite_sequence;\n"
    sql += "COMMIT;"

    await this.exec(sql)
  }

  async clearTable(tableName) {
    if (this.isClosing) {
      throw new Error("Database is closing")
    }

    if (!tableName) {
      throw new Error("Table name is required")
    }

    const sql = `
      BEGIN;
      DELETE FROM "${tableName}";
      DELETE FROM sqlite_sequence WHERE name='${tableName}';
      COMMIT;
    `

    await this.exec(sql)
  }

  async pragma(command) {
    const result = await this.query(`PRAGMA ${command}`)
    return result[0] || null
  }

  _restartProcess(processObj) {
    const index = this.processPool.indexOf(processObj)
    if (index > -1) {
      this.processPool.splice(index, 1)
      
      if (processObj.proc && !processObj.proc.killed) {
        processObj.proc.stdin.end()
        processObj.proc.kill('SIGKILL')
      }
      
      // Try to create new process
      this._createProcess().catch(err => {
        this.emit("error", err)
      })
    }
  }

  async close() {
    this.isClosing = true
    
    // Wait for active queries
    while (this.processPool.some(p => p.isBusy)) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Close all processes
    for (const process of this.processPool) {
      if (process.proc && !process.proc.killed) {
        process.proc.stdin.end(".exit\n")
        process.proc.kill()
      }
    }
    
    this.processPool = []
    this.emit("closed")
  }
}

module.exports = Engine