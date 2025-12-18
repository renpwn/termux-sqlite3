const { spawn } = require("child_process")
const { trace } = require("./lib/debug")

class Engine {
  constructor(filename) {
    this.proc = spawn("sqlite3", ["-json", filename], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    this.queue = []
    this.buffer = ""
    this.writeQueue = Promise.resolve()

    this.proc.stdout.on("data", d => this._onData(d))
    this.proc.stderr.on("data", d => {
      console.error("[sqlite3]", d.toString())
    })

    // ⏳ busy timeout
    this.proc.stdin.write(".timeout 5000\n")
  }

  _onData(data) {
    this.buffer += data.toString()
    if (!this.buffer.endsWith("\n")) return

    const out = this.buffer.trim()
    this.buffer = ""

    const job = this.queue.shift()
    if (!job) return

    try {
      const parsed = out ? JSON.parse(out) : []
      job.resolve(parsed)
    } catch (e) {
      job.reject(e)
    }
  }

  query(sql) {
    trace(sql)

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      this.proc.stdin.write(sql + ";\n")
    })
  }

  exec(sql) {
    trace(sql)

    this.writeQueue = this.writeQueue.then(() => {
      return new Promise(resolve => {
        this.proc.stdin.write(sql + ";\n")
        resolve()
      })
    })

    return this.writeQueue
  }

  close() {
    this.proc.stdin.end(".exit\n")
    this.proc.kill()
  }
}

module.exports = Engine