function explainSQL(sql) {
  return `EXPLAIN QUERY PLAN ${sql}`
}

module.exports = { explainSQL }