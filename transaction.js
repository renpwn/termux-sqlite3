async function transaction(engine, fn, options = {}) {
  const {
    isolationLevel = 'DEFERRED',
    retries = 3,
    savepoints = true
  } = options
  
  const levels = ['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE']
  
  if (!levels.includes(isolationLevel.toUpperCase())) {
    throw new Error(`Invalid isolation level. Use: ${levels.join(', ')}`)
  }
  
  let savepointId = 1
  const savepointStack = []
  
  const beginTx = async () => {
    await engine.exec(`BEGIN ${isolationLevel} TRANSACTION`)
  }
  
  const createSavepoint = async () => {
    if (!savepoints) return null
    const name = `sp_${savepointId++}`
    await engine.exec(`SAVEPOINT ${name}`)
    savepointStack.push(name)
    return name
  }
  
  const releaseSavepoint = async (name) => {
    if (!savepoints || !name) return
    await engine.exec(`RELEASE SAVEPOINT ${name}`)
    const index = savepointStack.indexOf(name)
    if (index > -1) savepointStack.splice(index, 1)
  }
  
  const rollbackToSavepoint = async (name) => {
    if (!savepoints || !name) return false
    if (!savepointStack.includes(name)) return false
    
    await engine.exec(`ROLLBACK TO SAVEPOINT ${name}`)
    return true
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await beginTx()
      
      // Create initial savepoint
      const mainSavepoint = await createSavepoint()
      
      try {
        const result = await fn({
          savepoint: async () => {
            return createSavepoint()
          },
          rollbackTo: async (name) => {
            return rollbackToSavepoint(name)
          },
          release: async (name) => {
            return releaseSavepoint(name)
          }
        })
        
        // Release all savepoints
        while (savepointStack.length > 0) {
          const sp = savepointStack.pop()
          await engine.exec(`RELEASE SAVEPOINT ${sp}`)
        }
        
        await engine.exec('COMMIT')
        return result
      } catch (error) {
        // Rollback to main savepoint first
        if (mainSavepoint) {
          await rollbackToSavepoint(mainSavepoint)
        }
        
        // Check if it's a retryable error
        const isRetryable = 
          error.message.includes('database is locked') ||
          error.message.includes('SQLITE_BUSY')
        
        if (isRetryable && attempt < retries) {
          await engine.exec('ROLLBACK')
          savepointStack.length = 0
          
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          )
          continue
        }
        
        await engine.exec('ROLLBACK')
        throw error
      }
    } catch (error) {
      if (attempt === retries) {
        throw error
      }
    }
  }
  
  throw new Error('Transaction failed after all retries')
}

// Export with helper methods
const tx = Object.assign(transaction, {
  deferred: (engine, fn, options) => transaction(engine, fn, { ...options, isolationLevel: 'DEFERRED' }),
  immediate: (engine, fn, options) => transaction(engine, fn, { ...options, isolationLevel: 'IMMEDIATE' }),
  exclusive: (engine, fn, options) => transaction(engine, fn, { ...options, isolationLevel: 'EXCLUSIVE' }),
  
  // Batch transaction helper
  batch: async (engine, operations, options) => {
    return transaction(engine, async (tx) => {
      const results = []
      for (const op of operations) {
        if (typeof op === 'function') {
          results.push(await op(tx))
        } else {
          results.push(await engine.exec(op))
        }
      }
      return results
    }, options)
  }
})

module.exports = tx