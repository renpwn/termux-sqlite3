async function transaction(engine, fn, isolationLevel = 'DEFERRED') {
  const levels = ['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE']
  
  if (!levels.includes(isolationLevel.toUpperCase())) {
    throw new Error(`Invalid isolation level. Use: ${levels.join(', ')}`)
  }
  
  await engine.exec(`BEGIN ${isolationLevel.toUpperCase()} TRANSACTION`)
  
  try {
    const result = await fn()
    await engine.exec('COMMIT')
    return result
  } catch (error) {
    try {
      await engine.exec('ROLLBACK')
    } catch (rollbackError) {
      console.error('[Transaction Rollback Error]', rollbackError)
    }
    throw error
  }
}

// Export transaction function with isolation level helper
module.exports = Object.assign(transaction, {
  deferred: (engine, fn) => transaction(engine, fn, 'DEFERRED'),
  immediate: (engine, fn) => transaction(engine, fn, 'IMMEDIATE'),
  exclusive: (engine, fn) => transaction(engine, fn, 'EXCLUSIVE')
})