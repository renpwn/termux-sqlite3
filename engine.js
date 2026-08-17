const { spawn } = require("child_process")
const { trace } = require("./lib/debug")
const EventEmitter = require("events")
const os = require("os")

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
    this._queryCounter = 0
    
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
      const defaultTmp = process.platform === 'android'
        ? "/data/data/com.termux/files/usr/tmp"
        : os.tmpdir()

      const proc = spawn("sqlite3", ["-json", this.filename], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, SQLITE_TMPDIR: process.env.SQLITE_TMPDIR || defaultTmp }
      })
      
      const processObj = {
        proc,
        isBusy: true,
        buffer: "",
        responseBuffer: "",
        initResolve: null,
        queryResolve: null,
        queryReject: null,
        currentQuery: null,
        currentQueryId: null,
        lastUsed: Date.now()
      }
  
      const initTimeout = setTimeout(() => {
        this._restartProcess(processObj)
        reject(new Error("Process initialization timeout"))
      }, 5000)
  
      // resolve akan dipanggil saat __READY__ diterima
      processObj.initResolve = () => {
        clearTimeout(initTimeout)
        processObj.isBusy = false
        processObj.initResolve = null
        this.processPool.push(processObj)
        resolve(processObj)
      }
  
      proc.stdout.on("data", (chunk) => {
        processObj.buffer += chunk.toString()
        this._processBuffer(processObj)
      })
  
      proc.stderr.on("data", (data) => {
        const msg = data.toString().trim()
        if (!msg || msg.includes("Warning:")) return

        const sql = processObj.currentQuery || "<unknown>"

        const error = new Error(`SQLite Error: ${msg}`)
        error.sql = sql
        error.sqlite = msg

        if (processObj.queryReject) {
          processObj.queryReject(error)
        } else {
          this.emit("error", error)
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
  
      // Sentinel initialization
      proc.stdin.write(".print __READY__\n")
    })
  }

  _processBuffer(processObj) {
    const lines = processObj.buffer.split('\n')
  
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
  
      // === READY sentinel (INIT) ===
      if (line.trim() === "__READY__") {
        processObj.initResolve?.()
        continue
      }
  
      // === END sentinel (QUERY SELESAI) ===
      const expectedEnd = processObj.currentQueryId ? `__END_${processObj.currentQueryId}__` : "__END__"
      if (line.trim() === expectedEnd) {
        const raw = processObj.responseBuffer.trim()
        processObj.responseBuffer = ""
  
        try {
          const result = raw ? JSON.parse(raw) : []
          processObj.queryResolve?.(
            Array.isArray(result) ? result : [result]
          )
        } catch (err) {
          processObj.queryReject?.(
            new Error(`JSON Parse Error: ${err.message}, Data: ${raw}`)
          )
        }
  
        // RESET STATE
        processObj.queryResolve = null
        processObj.queryReject = null
        processObj.currentQuery = null
        processObj.currentQueryId = null
        processObj.isBusy = false
        processObj.lastUsed = Date.now()
  
        continue
      }
  
      // === OUTPUT QUERY ===
      processObj.responseBuffer += line + "\n"
    }
  
    // simpan sisa buffer
    processObj.buffer = lines[lines.length - 1]
  }

  async _getAvailableProcess() {
    // 1️⃣ CARI YANG IDLE
    let proc = this.processPool.find(p => !p.isBusy)
    if (proc) {
      proc.isBusy = true
      proc.lastUsed = Date.now()
      return proc
    }
  
    // 2️⃣ CARI STALE / ZOMBIE (> timeout)
    const now = Date.now()
    const stale = this.processPool.find(
      p => p.isBusy && (now - p.lastUsed > this.options.timeout)
    )
  
    if (stale) {
      this._restartProcess(stale)
      await new Promise(r => setTimeout(r, 50))
      let available = this.processPool.find(p => !p.isBusy)
      if (available) {
        available.isBusy = true
        available.lastUsed = Date.now()
        return available
      }
    }
  
    // 3️⃣ BOLEH BUAT BARU?
    if (this.processPool.length < this.options.poolSize) {
      const created = await this._createProcess()
      created.isBusy = true
      created.lastUsed = Date.now()
      return created
    }
  
    // 4️⃣ TUNGGU SEBENTAR & COBA LAGI (Polling loop dengan timeout)
    const waitStart = Date.now()
    while (Date.now() - waitStart < this.options.timeout) {
      await new Promise(r => setTimeout(r, 20))
      let available = this.processPool.find(p => !p.isBusy)
      if (available) {
        available.isBusy = true
        available.lastUsed = Date.now()
        return available
      }
    }

    return null
  }

  async _executeWithRetry(sql, retries = 0) {
    try {
      const processObj = await this._getAvailableProcess()

      // clean sql
      sql = sql.replace(/;+\s*$/, "")

      if (!processObj) {
        throw new Error("No available SQLite process")
      }
  
      return new Promise((resolve, reject) => {
        const queryId = ++this._queryCounter
        const timeoutId = setTimeout(() => {
          processObj.queryReject?.(
            new Error(`Query timeout after ${this.options.timeout}ms`)
          )
          this._restartProcess(processObj)
        }, this.options.timeout)
  
        processObj.isBusy = true
        processObj.currentQuery = sql
        processObj.currentQueryId = queryId
  
        processObj.queryResolve = (data) => {
          clearTimeout(timeoutId)
          resolve(data)
        }
  
        processObj.queryReject = (err) => {
          clearTimeout(timeoutId)
          reject(err)
        }
  
        trace(sql)
        processObj.proc.stdin.write(
          sql + ";\n.print __END_" + queryId + "__\n"
        )
      })
  
    } catch (error) {
      if (retries < this.options.maxRetries) {
        await new Promise(r => setTimeout(r, 100 * (retries + 1)))
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

    const trimmed = sql.trim()

    // Deteksi multi-statement
    const isMulti =
      trimmed.includes(";") &&
      trimmed.split(";").filter(s => s.trim()).length > 1

    let finalSQL = trimmed

    if (isMulti) {
      finalSQL = `
        BEGIN IMMEDIATE;
        ${trimmed.replace(/;+\s*$/, "")};
        COMMIT;
      `
    }

    await this._executeWithRetry(finalSQL)
    return { changes: 0 }
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
  
    const pool = [...this.processPool]
    this.processPool = []

    for (const processObj of pool) {
      if (processObj.proc && !processObj.proc.killed) {
        try {
          processObj.proc.stdin.write(".exit\n")
          processObj.proc.stdin.end()
        } catch {}
        setTimeout(() => {
          try {
            if (processObj.proc && !processObj.proc.killed) {
              processObj.proc.kill()
            }
          } catch {}
        }, 100)
      }
    }
  
    this.emit("closed")
  }
}

module.exports = Engine