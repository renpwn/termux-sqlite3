const os = require('os')

function detectChunkSize(options = {}) {
  const {
    minChunk = 100,
    maxChunk = 10000,
    safetyFactor = 0.7, // Use 70% of available memory
    baseMemory = 50 // Base memory for Node process in MB
  } = options
  
  // Get system memory info
  const totalMemMB = os.totalmem() / 1024 / 1024
  const freeMemMB = os.freemem() / 1024 / 1024
  
  // Get process memory
  const procMem = process.memoryUsage()
  const rssMB = procMem.rss / 1024 / 1024
  const heapUsedMB = procMem.heapUsed / 1024 / 1024
  
  // Calculate available memory for data
  const availableMB = Math.min(freeMemMB, totalMemMB * safetyFactor) - baseMemory
  
  if (availableMB < 10) {
    return minChunk // Very low memory
  }
  
  if (availableMB < 50) {
    return Math.min(500, maxChunk)
  }
  
  if (availableMB < 100) {
    return Math.min(1000, maxChunk)
  }
  
  if (availableMB < 200) {
    return Math.min(2000, maxChunk)
  }
  
  if (availableMB < 500) {
    return Math.min(5000, maxChunk)
  }
  
  return maxChunk
}

// Adaptive chunk size based on row size estimation
async function estimateOptimalChunkSize(engine, tableName, sampleRows = 100) {
  try {
    // Sample some rows to estimate average size
    const sample = await engine.query(
      `SELECT * FROM ${tableName} LIMIT ${sampleRows}`
    )
    
    if (sample.length === 0) return 1000
    
    // Estimate average row size in bytes
    const totalSize = JSON.stringify(sample).length
    const avgRowSize = totalSize / sample.length
    
    // Calculate how many rows can fit in available memory
    const availableMB = os.freemem() / 1024 / 1024
    const safetyMB = availableMB * 0.5 // Use 50% of free memory
    
    const rowsPerMB = (1024 * 1024) / avgRowSize
    const optimalChunk = Math.floor(rowsPerMB * safetyMB)
    
    // Clamp between reasonable limits
    return Math.max(100, Math.min(10000, optimalChunk))
  } catch (error) {
    return detectChunkSize()
  }
}

module.exports = { detectChunkSize, estimateOptimalChunkSize }