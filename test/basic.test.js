const assert = require('assert')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const { bind, bindValue, escapeString, splitSqlTokens } = require('../lib/binder')
const { splitDatabase } = require('../lib/splitter')
const { ensureSplitDatabase } = require('../lib/split')
const Database = require('../index')

async function runTests() {
  console.log('--- RUNNING TEST SUITE ---')

  // 1. Binder Tests
  console.log('Test 1: binder.escapeString')
  assert.strictEqual(escapeString("Hello World"), "'Hello World'")
  assert.strictEqual(escapeString("O'Reilly"), "'O''Reilly'")
  assert.strictEqual(escapeString("C:\\path\\to\\file"), "'C:\\path\\to\\file'")

  console.log('Test 2: binder.bindValue')
  assert.strictEqual(bindValue(null), 'NULL')
  assert.strictEqual(bindValue(undefined), 'NULL')
  assert.strictEqual(bindValue(123), '123')
  assert.strictEqual(bindValue(12.34), '12.34')
  assert.strictEqual(bindValue(BigInt(999999999999)), '999999999999')
  assert.strictEqual(bindValue(true), '1')
  assert.strictEqual(bindValue(false), '0')
  assert.strictEqual(bindValue('test'), "'test'")
  assert.strictEqual(bindValue([1, 'a', false]), "(1, 'a', 0)")
  assert.strictEqual(bindValue(Buffer.from('hello', 'utf8')), "X'68656c6c6f'")

  console.log('Test 3: binder.bind positional & named')
  const posSql = bind("SELECT * FROM users WHERE age > ? AND name = ?", [20, "John's"])
  assert.strictEqual(posSql, "SELECT * FROM users WHERE age > 20 AND name = 'John''s'")

  const namedSql = bind("SELECT * FROM users WHERE age > :age AND name = :name", { age: 30, name: "Alice" })
  assert.strictEqual(namedSql, "SELECT * FROM users WHERE age > 30 AND name = 'Alice'")

  console.log('Test 4: binder ignores strings with ? or :named inside literals')
  const literalSql1 = bind("SELECT 'Siapa?' as question, * FROM users WHERE id = ?", [10])
  assert.strictEqual(literalSql1, "SELECT 'Siapa?' as question, * FROM users WHERE id = 10")

  const literalSql2 = bind("SELECT 'Value :test' as txt, * FROM users WHERE id = :id", { id: 5 })
  assert.strictEqual(literalSql2, "SELECT 'Value :test' as txt, * FROM users WHERE id = 5")

  // 2. Splitter & Split Rebuilder Tests
  console.log('Test 5: splitter and ensureSplitDatabase')
  const testDir = path.join(__dirname, 'tmp_test_split')
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
  fs.mkdirSync(testDir, { recursive: true })

  const sampleDbPath = path.join(testDir, 'sample.db')
  const sampleData = Buffer.alloc(1024 * 512, 'a') // 512 KB dummy data
  fs.writeFileSync(sampleDbPath, sampleData)

  // Split into 0.1 MB parts
  splitDatabase(sampleDbPath, {
    partSizeMB: 0.1,
    outputDir: testDir,
    overwrite: true
  })

  const manifestPath = path.join(testDir, 'sample.db.manifest.json')
  assert.ok(fs.existsSync(manifestPath), 'Manifest should exist')

  // Remove original database
  fs.unlinkSync(sampleDbPath)
  assert.ok(!fs.existsSync(sampleDbPath), 'Original file should be deleted')

  // Rebuild
  ensureSplitDatabase(sampleDbPath, {
    enabled: true,
    dir: testDir,
    mode: 'always',
    verify: true
  })

  assert.ok(fs.existsSync(sampleDbPath), 'Rebuilt file should exist')
  const rebuiltData = fs.readFileSync(sampleDbPath)
  assert.strictEqual(rebuiltData.length, sampleData.length, 'Size should match')
  assert.strictEqual(
    crypto.createHash('sha256').update(rebuiltData).digest('hex'),
    crypto.createHash('sha256').update(sampleData).digest('hex'),
    'Checksum should match'
  )

  // Clean up test dir
  fs.rmSync(testDir, { recursive: true, force: true })

  console.log('Test 6: Database export integrity')
  assert.strictEqual(typeof Database, 'function')
  assert.strictEqual(typeof Database.prototype.prepare, 'function')
  assert.strictEqual(typeof Database.prototype.transaction, 'function')
  assert.strictEqual(typeof Database.prototype.exec, 'function')

  console.log('\n✅ ALL BASIC TESTS PASSED SUCCESSFULLY!')
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
