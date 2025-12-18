function detectChunkSize() {
  const mb = process.memoryUsage().rss / 1024 / 1024

  if (mb < 40) return 200
  if (mb < 80) return 500
  if (mb < 150) return 1000
  return 2000
}

module.exports = { detectChunkSize }