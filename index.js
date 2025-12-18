const Engine = require("./engine")
const Statement = require("./statement")
const transaction = require("./transaction")

class Database {
  constructor(filename) {
    this.engine = new Engine(filename)
  }

  exec(sql) {
    return this.engine.exec(sql)
  }

  prepare(sql) {
    return new Statement(this.engine, sql)
  }

  transaction(fn) {
    return transaction(this.engine, fn)
  }

  close() {
    this.engine.close()
  }
}

module.exports = Database