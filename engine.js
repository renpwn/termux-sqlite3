const { spawn } = require("child_process")
const { trace } = require("./lib/debug")

class Engine {
  constructor(filename) {
    this.filename = filename
    this.proc = null
    this.queue = []
    this.buffer = ""
    this.isReady = false
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })
    
    this._initProcess()
  }

  _initProcess() {
    this.proc = spawn("sqlite3", ["-json", this.filename], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    this.proc.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString()
      this._processBuffer()
    })

    this.proc.stderr.on("data", (data) => {
      console.error("[SQLite Error]", data.toString())
    })

    this.proc.on("error", (err) => {
      console.error("[Process Error]", err)
      this._rejectAll(err)
    })

    this.proc.on("exit", (code) => {
      if (code !== 0) {
        this._rejectAll(new Error(`Process exited with code ${code}`))
      }
    })

    // Set timeout and enable JSON mode
    this.proc.stdin.write(".timeout 5000\n")
    this.proc.stdin.write(".mode json\n")
    
    // Test connection
    this.proc.stdin.write("SELECT 1 as test;\n")
    
    // Mark as ready after successful test
    setTimeout(() => {
      this.isReady = true
      this.readyResolve()
    }, 100)
  }

  _processBuffer() {
    const lines = this.buffer.split("\n")
    
    // Keep incomplete line in buffer
    this.buffer = lines.pop() || ""
    
    for (const line of lines) {
      if (line.trim() === "") continue
      
      const job = this.queue.shift()
      if (!job) continue
      
      try {
        if (line === "[]") {
          job.resolve([])
        } else {
          const parsed = JSON.parse(line)
          job.resolve(Array.isArray(parsed) ? parsed : [parsed])
        }
      } catch (e) {
        job.reject(new Error(`Failed to parse JSON: ${line}`))
      }
    }
  }

  async query(sql) {
    await this.readyPromise
    
    trace(sql)
    
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      
      // Ensure SQL ends with semicolon
      const formattedSQL = sql.trim().endsWith(";") ? sql : sql + ";"
      this.proc.stdin.write(formattedSQL + "\n")
    })
  }

  async exec(sql) {
    await this.readyPromise
    
    trace(sql)
    
    return new Promise((resolve, reject) => {
      const callback = (data) => {
        resolve()
      }
      
      this.queue.push({ resolve: callback, reject })
      
      const formattedSQL = sql.trim().endsWith(";") ? sql : sql + ";"
      this.proc.stdin.write(formattedSQL + "\n")
    })
  }

  _rejectAll(error) {
    while (this.queue.length > 0) {
      const job = this.queue.shift()
      if (job && job.reject) {
        job.reject(error)
      }
    }
  }

  close() {
    if (this.proc && !this.proc.killed) {
      this.proc.stdin.end()
      this.proc.kill()
    }
  }
}

module.exports = Engine