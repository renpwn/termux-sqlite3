// benchmark.js
const Database = require('./index.js')

async function benchmark() {
  const db = new Database('test.db')
  
  // Create test table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      age INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Insert benchmark
  console.time('insert-1000')
  await db.transaction(async () => {
    for (let i = 0; i < 1000; i++) {
      await db.run(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        [`User ${i}`, `user${i}@test.com`, Math.floor(Math.random() * 50) + 18]
      )
    }
  })
  console.timeEnd('insert-1000')
  
  // Query benchmark
  console.time('query-all')
  const allUsers = await db.all("SELECT * FROM users WHERE age > ?", [25])
  console.timeEnd('query-all')
  console.log(`Found ${allUsers.length} users`)
  
  // Cursor benchmark
  console.time('cursor-iterate')
  const stmt = db.prepare("SELECT * FROM users ORDER BY id")
  let cursorCount = 0
  for await (const user of stmt.iterate({ chunk: 'auto' })) {
    cursorCount++
  }
  console.timeEnd('cursor-iterate')
  
  await db.close()
}

benchmark().catch(console.error)