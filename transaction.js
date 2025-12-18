function transaction(engine, fn) {
  return engine.exec("BEGIN;")
    .then(() => fn())
    .then(() => engine.exec("COMMIT;"))
    .catch(async err => {
      await engine.exec("ROLLBACK;")
      throw err
    })
}

module.exports = transaction