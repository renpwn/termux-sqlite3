# @renpwn/termux-sqlite3

![Termux](https://img.shields.io/badge/Termux-Android-00B0F0?style=for-the-badge&logo=android)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

`@renpwn/termux-sqlite3` adalah wrapper SQLite berbasis JavaScript murni (pure JavaScript) yang dirancang khusus untuk lingkungan **Termux** di Android. Library ini memberikan pengalaman pengembangan yang serupa dengan better-sqlite3, namun tanpa memerlukan proses kompilasi modul binari (native addons) yang seringkali sulit dilakukan di perangkat seluler.

Library ini bekerja dengan melakukan spawning terhadap proses `sqlite3` sistem dan berkomunikasi melalui antarmuka JSON yang efisien, dengan dukungan connection pooling, memory management adaptif, dan transaksi lengkap.

## ✨ Fitur Utama

* **🚫 Zero Native Dependencies:** Tidak memerlukan `node-gyp`, Python, atau kompilasi C++; hanya membutuhkan binary `sqlite3` terinstal di Termux.
* **📚 API Mirip Better-sqlite3:** Menggunakan pola `prepare()`, `get()`, `all()`, dan `run()` yang familiar.
* **💾 Memory Management Pintar:** Cursor dengan adaptive chunking yang menyesuaikan ukuran pengambilan data berdasarkan penggunaan RAM perangkat.
* **🔒 Transaksi Lengkap:** Dukungan transaksi atomik dengan isolation levels (DEFERRED, IMMEDIATE, EXCLUSIVE), savepoints, dan automatic rollback.
* **🛡️ SQL Binding Aman:** Mencegah SQL Injection dengan sistem binding parameter menggunakan sintaks `:key` atau `?`.
* **🔍 Query Analysis:** Mendukung `EXPLAIN QUERY PLAN` untuk optimasi query.
* **⚡ Connection Pooling:** Multi-process pool untuk concurrent queries dengan timeout management.
* **🔄 Streaming Data:** Async iteration untuk dataset besar tanpa memori overload.
* **🗑️ Data Management:** Lengkap dengan fungsi `clearTable()`, `clearAllTables()`, dan `resetDatabase()`.
* **🔧 Debugging Tools:** Built-in debug mode untuk tracing query execution.

## 📋 Prasyarat

* **Termux** (versi 0.118.0 atau lebih baru)
* **Node.js** (versi 14.0.0 atau lebih baru)
* **SQLite3 Binary** (versi 3.40.0 atau lebih baru)

## 🚀 Instalasi

1. **Instal Dependensi di Termux:**

```bash
# Update package list
pkg update

# Instal SQLite3 dan Node.js
pkg install sqlite nodejs -y

# Verifikasi instalasi
sqlite3 --version
node --version
```

2. **Instal Library termux-sqlite3:**

```bash
# Instal dari GitHub (rekomendasi untuk versi terbaru)
npm install https://github.com/renpwn/termux-sqlite3

# Atau dari npm registry
npm install @renpwn/termux-sqlite3
```

## 📖 Quick Start

### **Inisialisasi Database**

```javascript
const Database = require('@renpwn/termux-sqlite3');

// Buka koneksi database (file akan dibuat jika tidak ada)
const db = new Database('myapp.db');

// Dengan opsi tambahan
const db2 = new Database('myapp.db', {
  timeout: 10000,           // Timeout 10 detik per query
  poolSize: 2,              // 2 koneksi paralel
  busyTimeout: 10000,       // Tunggu 10 detik jika database locked
  maxRetries: 3             // Retry otomatis untuk locked database
});

// Event listener untuk error handling
db.on('error', (err) => {
  console.error('Database Error:', err.message);
});

db.on('closed', () => {
  console.log('Database connection closed');
});
```

### **Membuat Tabel dan Operasi Dasar**

```javascript
// Membuat tabel
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    age INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Menambahkan data menggunakan prepared statement
const insertStmt = db.prepare(
  'INSERT INTO users (name, email, age) VALUES (:name, :email, :age)'
);
const result = await insertStmt.run({
  name: 'John Doe',
  email: 'john@example.com',
  age: 25
});
console.log(`ID baru: ${result.lastInsertRowid}, Changes: ${result.changes}`);

// Query data single row
const user = await db.get(
  'SELECT * FROM users WHERE id = ?',
  [1]
);
console.log('User ditemukan:', user);

// Query multiple rows
const activeUsers = await db.all(
  'SELECT * FROM users WHERE age > :minAge',
  { minAge: 18 }
);
console.log(`Found ${activeUsers.length} active users`);
```

### **Data Management Operations**

```javascript
// Hapus data dari tabel tertentu
const clearResult = await db.clearTable('users', {
  resetAutoincrement: true  // Reset ID counter ke 0
});
console.log(`Cleared ${clearResult.deletedCount} users`);

// Hapus semua data dari semua tabel
const clearAllResult = await db.clearAllTables({
  skipConfirmation: true,   // Lewati peringatan di non-production
  vacuumAfter: true         // Optimasi storage setelah clear
});
console.log(`Cleared ${clearAllResult.totalDeleted} rows from ${clearAllResult.totalTables} tables`);

// Reset database lengkap
const resetResult = await db.resetDatabase();
console.log('Database reset complete:', resetResult.message);
```

## 🛠️ API Reference Lengkap

### **Kelas Database**

#### `new Database(filename, options)`
Membuka koneksi ke database SQLite.

**Parameter:**
- `filename` (String): Path ke file database
- `options` (Object, opsional):
  - `timeout` (Number): Query timeout dalam ms (default: `5000`)
  - `poolSize` (Number): Jumlah koneksi paralel (default: `1`)
  - `busyTimeout` (Number): Waktu tunggu saat database locked dalam ms (default: `5000`)
  - `maxRetries` (Number): Maksimal retry attempts (default: `3`)

**Contoh:**
```javascript
const db = new Database('/data/data/com.termux/files/home/myapp.db', {
  timeout: 15000,
  poolSize: 3,
  busyTimeout: 10000
});
```

#### `db.prepare(sql)`
Membuat prepared statement untuk eksekusi berulang.

**Contoh:**
```javascript
const stmt = db.prepare('SELECT * FROM users WHERE email = :email');
const user = await stmt.get({ email: 'test@example.com' });
```

#### `db.exec(sql)`
Menjalankan perintah SQL tanpa mengembalikan hasil (untuk DDL, INSERT, UPDATE, DELETE).

**Contoh:**
```javascript
await db.exec('CREATE INDEX idx_users_email ON users(email)');
```

#### `db.transaction(fn, options)`
Menjalankan blok kode dalam transaksi.

**Contoh:**
```javascript
await db.transaction(async () => {
  await db.run('INSERT INTO accounts (balance) VALUES (100)');
  await db.run('INSERT INTO transactions (amount) VALUES (100)');
});
```

#### `db.pragma(name, value)`
Mengakses atau mengatur pragma SQLite.

**Contoh:**
```javascript
const version = await db.pragma('sqlite_version');
await db.pragma('journal_mode', 'WAL');
await db.pragma('foreign_keys', 'ON');
```

#### `db.close()`
Menutup koneksi database.

**Contoh:**
```javascript
await db.close();
```

### **Data Management Operations**

#### `db.clearTable(tableName, options)`
Menghapus semua data dari tabel tertentu tanpa menghapus struktur tabel.

**Parameter:**
- `tableName` (String): Nama tabel yang akan dibersihkan
- `options` (Object, opsional):
  - `disableForeignKeys` (Boolean): Nonaktifkan foreign key constraints (default: `false`)
  - `resetAutoincrement` (Boolean): Reset autoincrement counter (default: `false`)
  - `vacuumAfter` (Boolean): Jalankan VACUUM setelah clear (default: `false`)

**Return Value:**
```javascript
{
  table: 'users',
  deletedCount: 42,
  resetAutoincrement: true,
  vacuumPerformed: false
}
```

**Contoh:**
```javascript
// Hapus semua data dari tabel users
const result = await db.clearTable('users')
console.log(`Deleted ${result.deletedCount} rows from ${result.table}`)

// Dengan opsi lengkap
const result2 = await db.clearTable('logs', {
  resetAutoincrement: true,
  vacuumAfter: true
})
```

#### `db.clearAllTables(options)`
Menghapus semua data dari SEMUA tabel user di database.

⚠️ **PERINGATAN:** Fungsi ini akan menghapus SEMUA data dari SEMUA tabel user!

**Parameter:**
- `options` (Object, opsional):
  - `skipSystemTables` (Boolean): Lewati tabel sistem SQLite (default: `true`)
  - `disableForeignKeys` (Boolean): Nonaktifkan foreign key constraints (default: `true`)
  - `resetAutoincrement` (Boolean): Reset semua autoincrement counters (default: `true`)
  - `vacuumAfter` (Boolean): Jalankan VACUUM setelah clear (default: `true`)
  - `skipConfirmation` (Boolean): Lewati warning confirmation (default: `false`)

**Return Value:**
```javascript
{
  clearedTables: [
    { table: 'users', deletedCount: 42, autoincrementReset: true },
    { table: 'logs', deletedCount: 1000, autoincrementReset: true }
  ],
  totalTables: 2,
  totalDeleted: 1042,
  vacuumPerformed: true,
  autoincrementReset: true
}
```

**Contoh:**
```javascript
// Hapus semua data dari semua tabel
const result = await db.clearAllTables()
console.log(`Cleared ${result.totalTables} tables, deleted ${result.totalDeleted} rows total`)

// Hanya reset data, tanpa VACUUM
const result2 = await db.clearAllTables({
  vacuumAfter: false,
  resetAutoincrement: false
})
```

#### `db.truncateTable(tableName, options)`
Alias untuk `clearTable` dengan autoincrement reset otomatis.

**Contoh:**
```javascript
// Sama seperti clearTable dengan resetAutoincrement: true
await db.truncateTable('counters')
```

#### `db.resetDatabase(options)`
Reset lengkap database: clear semua tabel + VACUUM + reset pragma settings ke default.

**Parameter:**
- `options` (Object, opsional): Opsi yang sama dengan `clearAllTables`

**Return Value:**
```javascript
{
  clearedTables: [...],
  totalTables: 3,
  totalDeleted: 1500,
  vacuumPerformed: true,
  autoincrementReset: true,
  pragmaReset: true,
  message: 'Database completely reset to initial state'
}
```

**Contoh:**
```javascript
// Reset database ke state awal
await db.resetDatabase()
```

### **Kelas Statement**

#### `stmt.all(params)`
Mengembalikan semua baris hasil query.

**Contoh:**
```javascript
const users = await stmt.all({ status: 'active' });
```

#### `stmt.get(params)`
Mengembalikan baris pertama hasil query.

**Contoh:**
```javascript
const user = await stmt.get({ id: 1 });
```

#### `stmt.run(params)`
Menjalankan statement (INSERT, UPDATE, DELETE) dan mengembalikan metadata.

**Contoh:**
```javascript
const result = await stmt.run({ name: 'Alice', age: 30 });
console.log(`Changes: ${result.changes}, Last ID: ${result.lastInsertRowid}`);
```

#### `stmt.iterate(options)`
Mengembalikan async generator untuk iterasi data besar.

**Contoh:**
```javascript
for await (const row of stmt.iterate({ chunk: 'auto' })) {
  processRow(row);
}
```

#### `stmt.explain(params)`
Menjalankan EXPLAIN QUERY PLAN pada statement.

**Contoh:**
```javascript
const plan = await stmt.explain();
console.log('Query Plan:', plan);
```

#### `stmt.columns()`
Mengembalikan informasi kolom dari tabel yang diquery.

**Contoh:**
```javascript
const columns = await stmt.columns();
console.log('Table columns:', columns);
```

## 🔄 Iterasi Data Besar dengan Cursor

Untuk dataset yang besar, gunakan cursor untuk menghindari kehabisan memori:

```javascript
const stmt = db.prepare('SELECT * FROM sensor_data ORDER BY timestamp');

// Opsi 1: Chunk size tetap
for await (const row of stmt.iterate({ chunk: 1000 })) {
  await processData(row);
}

// Opsi 2: Adaptive chunking (otomatis berdasarkan memory)
for await (const row of stmt.iterate({ chunk: 'auto' })) {
  console.log(row);
}

// Opsi 3: Advanced configuration
const options = {
  chunk: 'adaptive',     // Adaptive chunk sizing
  minChunk: 100,         // Minimum 100 rows per chunk
  maxChunk: 5000,        // Maximum 5000 rows per chunk
  params: { year: 2024 }, // Parameter binding
  highWaterMark: 2       // Backpressure control
};

for await (const row of stmt.iterate(options)) {
  // Process dengan memory optimal
}

// Opsi 4: Convert ke array (hati-hati untuk data besar)
const allRows = await stmt.iterate({ chunk: 1000 }).toArray();
```

## 💰 Manajemen Transaksi Lengkap

### **Transaksi Sederhana**

```javascript
await db.transaction(async () => {
  await db.run('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
  await db.run('UPDATE accounts SET balance = balance + 100 WHERE id = 2');
});
```

### **Transaksi dengan Isolation Level**

```javascript
// DEFERRED (default) - Transaction starts on first read/write
await db.transaction(async () => {
  // Operasi database
}, { isolationLevel: 'DEFERRED' });

// IMMEDIATE - Transaction starts immediately, allows reads, prevents writes
await db.transaction(async () => {
  // Operasi database
}, { isolationLevel: 'IMMEDIATE' });

// EXCLUSIVE - Exclusive lock on database
await db.transaction(async () => {
  // Operasi database
}, { isolationLevel: 'EXCLUSIVE' });
```

### **Savepoints (Nested Transactions)**

```javascript
const transaction = require('@renpwn/termux-sqlite3/transaction');

await transaction(db.engine, async (tx) => {
  const sp1 = await tx.savepoint();
  
  try {
    await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
    await tx.release(sp1);
  } catch (err) {
    await tx.rollbackTo(sp1);
  }
}, { savepoints: true });
```

### **Batch Operations dengan Retry**

```javascript
const tx = require('@renpwn/termux-sqlite3/transaction');

await tx.batch(db.engine, [
  "DELETE FROM temp_data",
  "INSERT INTO logs (action) VALUES ('cleanup')",
  async () => {
    await db.run("VACUUM");
  }
], {
  isolationLevel: 'EXCLUSIVE',
  retries: 3
});
```

## 🔍 Debugging dan Optimasi

### **Aktifkan Debug Mode**

```javascript
const { enableDebug } = require('@renpwn/termux-sqlite3/debug');
enableDebug(true); // Semua query akan dicetak ke console.error
```

### **Analisis Query Performance**

```javascript
const stmt = db.prepare('SELECT * FROM users WHERE age > :age');
const explain = await stmt.explain({ age: 18 });
console.log('Query Plan:', explain);
```

### **Database Maintenance**

```javascript
// Optimasi database
await db.vacuum();

// WAL checkpoint
await db.checkpoint('PASSIVE');

// Backup database
await db.backup('/sdcard/backup.db');

// Clear data dari tabel tertentu
await db.clearTable('temp_data', { vacuumAfter: true });

// Reset database lengkap (hati-hati!)
await db.resetDatabase();
```

### **Memory Debugging**

```javascript
const { detectChunkSize } = require('@renpwn/termux-sqlite3/memory');
console.log('Recommended chunk size:', detectChunkSize());
```

## 📊 Contoh Aplikasi Lengkap

### **Aplikasi To-Do List dengan Data Management**

```javascript
const Database = require('@renpwn/termux-sqlite3');

class TodoApp {
  constructor() {
    this.db = new Database('todos.db');
    this._initPromise = this.init();
  }

  async ready() {
    await this._initPromise;
  }

  async init() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT 0,
        priority INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        action TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async addTask(title, description = '', priority = 1) {
    await this.ready();
    const result = await this.db.run(
      'INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)',
      [title, description, priority]
    );
    return result.lastInsertRowid;
  }

  async completeTask(id) {
    await this.ready();
    await this.db.run(
      'UPDATE tasks SET completed = 1 WHERE id = ?',
      [id]
    );
  }

  async getPendingTasks() {
    await this.ready();
    return this.db.all(
      'SELECT * FROM tasks WHERE completed = 0 ORDER BY priority DESC, created_at ASC'
    );
  }

  async getStats() {
    await this.ready();
    return this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(completed) as done,
        AVG(priority) as avg_priority
      FROM tasks
    `);
  }

  // Data management methods
  async clearCompletedTasks() {
    await this.ready();
    const result = await this.db.clearTable('tasks', {
      vacuumAfter: false,
      resetAutoincrement: false
    });
    
    // Log the action
    await this.db.run(
      'INSERT INTO task_history (action) VALUES (?)',
      [`Cleared ${result.deletedCount} completed tasks`]
    );
    
    return result;
  }

  async resetAppData() {
    await this.ready();
    console.log('⚠️  Resetting all application data...');
    
    const result = await this.db.clearAllTables({
      skipConfirmation: true,
      vacuumAfter: true,
      resetAutoincrement: true
    });
    
    console.log(`✅ Reset complete: ${result.totalDeleted} rows deleted`);
    return result;
  }

  async exportData() {
    await this.ready();
    const tasks = await this.db.all('SELECT * FROM tasks');
    const history = await this.db.all('SELECT * FROM task_history');
    
    return {
      tasks,
      history,
      exportedAt: new Date().toISOString()
    };
  }

  async close() {
    await this.db.close();
  }
}

// Penggunaan
async function main() {
  const app = new TodoApp();
  
  await app.addTask('Belajar Termux', 'Pelajari termux-sqlite3', 3);
  await app.addTask('Buat aplikasi', 'Buat aplikasi database', 2);
  
  const tasks = await app.getPendingTasks();
  console.log(`Ada ${tasks.length} tugas pending`);
  
  // Clear completed tasks
  const clearResult = await app.clearCompletedTasks();
  console.log(`Cleared ${clearResult.deletedCount} completed tasks`);
  
  // Reset all data (testing only!)
  // await app.resetAppData();
  
  await app.close();
}

main().catch(console.error);
```

### **Database Manager dengan Advanced Operations**

```javascript
const Database = require('@renpwn/termux-sqlite3');

class DatabaseManager {
  constructor(dbPath) {
    this.db = new Database(dbPath, { poolSize: 2 });
  }

  async init() {
    // Setup database dengan optimal settings
    await this.db.pragma('journal_mode = WAL');
    await this.db.pragma('synchronous = NORMAL');
    await this.db.pragma('cache_size = 2000');
    await this.db.pragma('foreign_keys = ON');
  }

  async safeClearTable(tableName) {
    // Clear table dengan safety checks
    try {
      // Cek apakah tabel exists
      const tableInfo = await this.db.tableInfo(tableName);
      if (!tableInfo || tableInfo.length === 0) {
        throw new Error(`Table '${tableName}' tidak ditemukan`);
      }

      // Backup row count
      const countResult = await this.db.get(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );
      const rowCount = countResult?.count || 0;

      if (rowCount === 0) {
        console.log(`Table ${tableName} sudah kosong`);
        return { table: tableName, deletedCount: 0, alreadyEmpty: true };
      }

      console.log(`Clearing ${rowCount} rows from ${tableName}...`);
      
      // Clear dengan foreign key handling
      const result = await this.db.clearTable(tableName, {
        disableForeignKeys: true,
        resetAutoincrement: true,
        vacuumAfter: false
      });

      console.log(`✅ Cleared ${result.deletedCount} rows from ${tableName}`);
      return result;

    } catch (error) {
      console.error(`❌ Failed to clear table ${tableName}:`, error.message);
      throw error;
    }
  }

  async batchClearTables(tableNames, options = {}) {
    // Clear multiple tables dalam transaction
    return await this.db.transaction(async () => {
      const results = [];
      
      for (const tableName of tableNames) {
        try {
          const result = await this.safeClearTable(tableName);
          results.push(result);
        } catch (error) {
          results.push({
            table: tableName,
            error: error.message,
            success: false
          });
          
          if (options.stopOnError) {
            throw error;
          }
        }
      }
      
      return results;
    });
  }

  async exportSchema() {
    // Export database schema tanpa data
    const tables = await this.db.all(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    const indexes = await this.db.all(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    );
    
    return {
      tables: tables.map(t => ({ name: t.name, sql: t.sql })),
      indexes: indexes.map(i => ({ name: i.name, sql: i.sql })),
      exportedAt: new Date().toISOString(),
      version: await this.db.pragma('schema_version')
    };
  }

  async importSchema(schema) {
    // Import schema (clear semua data terlebih dahulu)
    console.log('Importing schema...');
    
    // Clear semua tabel
    await this.db.clearAllTables({
      skipConfirmation: true,
      vacuumAfter: true
    });
    
    // Eksekusi SQL schema
    for (const table of schema.tables) {
      if (table.sql) {
        await this.db.exec(table.sql);
        console.log(`Created table: ${table.name}`);
      }
    }
    
    for (const index of schema.indexes) {
      if (index.sql) {
        await this.db.exec(index.sql);
        console.log(`Created index: ${index.name}`);
      }
    }
    
    console.log('✅ Schema imported successfully');
  }

  async getDatabaseInfo() {
    const tables = await this.db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    const tableStats = [];
    
    for (const table of tables) {
      const countResult = await this.db.get(
        `SELECT COUNT(*) as count FROM ${table.name}`
      );
      const sizeResult = await this.db.get(
        `SELECT SUM(pgsize) as size FROM dbstat WHERE name = ?`,
        [table.name]
      ).catch(() => ({ size: 0 }));
      
      tableStats.push({
        name: table.name,
        rowCount: countResult?.count || 0,
        estimatedSize: sizeResult?.size || 0
      });
    }
    
    return {
      tables: tableStats,
      totalTables: tables.length,
      totalRows: tableStats.reduce((sum, t) => sum + t.rowCount, 0),
      pragma: {
        version: await this.db.pragma('sqlite_version'),
        journalMode: await this.db.pragma('journal_mode'),
        foreignKeys: await this.db.pragma('foreign_keys')
      }
    };
  }

  async close() {
    await this.db.close();
  }
}

// Penggunaan
async function databaseManagementDemo() {
  const manager = new DatabaseManager('app.db');
  await manager.init();
  
  // Dapatkan info database
  const info = await manager.getDatabaseInfo();
  console.log('Database Info:', info);
  
  // Export schema
  const schema = await manager.exportSchema();
  console.log('Exported schema with', schema.tables.length, 'tables');
  
  // Clear tabel tertentu
  const clearResult = await manager.safeClearTable('logs');
  console.log('Clear result:', clearResult);
  
  // Batch clear
  const batchResult = await manager.batchClearTables(['temp_data', 'cache']);
  console.log('Batch clear result:', batchResult);
  
  await manager.close();
}

databaseManagementDemo().catch(console.error);
```

## ⚡ Performance Tips

### **1. Gunakan Prepared Statement untuk Query Berulang**

```javascript
// ✅ BENAR: Gunakan prepared statement
const stmt = db.prepare('INSERT INTO data (value) VALUES (?)');
for (const value of largeArray) {
  await stmt.run([value]);
}

// ❌ SALAH: Hindari re-prepare setiap iterasi
for (const value of largeArray) {
  await db.run('INSERT INTO data (value) VALUES (?)', [value]);
}
```

### **2. Gunakan Transaction untuk Batch Operations**

```javascript
// ✅ BENAR: Gunakan transaction untuk bulk insert
await db.transaction(async () => {
  for (const item of items) {
    await db.run('INSERT INTO products (name, price) VALUES (?, ?)', 
      [item.name, item.price]);
  }
});

// ❌ SALAH: Hindari autocommit setiap insert
for (const item of items) {
  await db.run('INSERT INTO products (name, price) VALUES (?, ?)', 
    [item.name, item.price]);
}
```

### **3. Pilih Chunk Size yang Tepat**

```javascript
// Untuk perangkat dengan RAM kecil (< 2GB)
for await (const row of stmt.iterate({ chunk: 100 })) { }

// Untuk perangkat dengan RAM besar (> 4GB)
for await (const row of stmt.iterate({ chunk: 5000 })) { }

// Biarkan library memutuskan (rekomendasi)
for await (const row of stmt.iterate({ chunk: 'auto' })) { }
```

### **4. Optimasi SQLite Settings**

```javascript
// Set di awal aplikasi untuk performa optimal
await db.pragma('journal_mode = WAL');
await db.pragma('synchronous = NORMAL');
await db.pragma('cache_size = 2000');
await db.pragma('temp_store = MEMORY');
await db.pragma('foreign_keys = ON');
```

### **5. Gunakan clearTable() untuk Bulk Deletes**

```javascript
// ✅ BENAR: Gunakan clearTable untuk delete semua data
await db.clearTable('temp_data', { vacuumAfter: true });

// ❌ SALAH: Hindari DELETE tanpa WHERE untuk tabel besar
await db.run('DELETE FROM temp_data'); // Bisa lambat untuk tabel besar
```

## 🐛 Troubleshooting

### **Error: "sqlite3: command not found"**

```bash
# Solusi: Instal sqlite3 di Termux
pkg install sqlite
```

### **Error: "database is locked"**

```javascript
// Solusi 1: Tingkatkan busyTimeout
const db = new Database('app.db', { 
  busyTimeout: 15000,
  maxRetries: 5 
});

// Solusi 2: Gunakan transaction dengan retry
await db.transaction(async () => {
  // operasi database
}, { 
  retries: 3,
  isolationLevel: 'IMMEDIATE' 
});

// Solusi 3: Kurangi poolSize
const db = new Database('app.db', { poolSize: 1 });
```

### **Error: "out of memory"**

```javascript
// Solusi 1: Kurangi chunk size
for await (const row of stmt.iterate({ chunk: 50 })) { }

// Solusi 2: Aktifkan adaptive chunking
for await (const row of stmt.iterate({ chunk: 'adaptive' })) { }

// Solusi 3: Gunakan clearTable() untuk bulk deletes
await db.clearTable('large_table', { vacuumAfter: true });

// Solusi 4: Bersihkan memory Node.js secara periodic
if (global.gc) {
  global.gc(); // Jalankan dengan --expose-gc flag
}
```

### **Error: "Cannot open database file"**

```javascript
// Solusi: Gunakan path absolut
const db = new Database('/data/data/com.termux/files/home/myapp.db');
```

### **Performance Lambat**

```javascript
// Optimasi settings
await db.pragma('journal_mode = WAL');
await db.pragma('synchronous = NORMAL');

// Gunakan index
await db.exec('CREATE INDEX idx_users_email ON users(email)');

// Gunakan EXPLAIN untuk analisis query
const plan = await db.prepare('SELECT * FROM users WHERE age > ?')
  .explain([18]);
console.log('Query plan:', plan);
```

### **Error saat clearTable()**

```javascript
try {
  await db.clearTable('users');
} catch (error) {
  if (error.message.includes('foreign key constraint')) {
    // Coba dengan disable foreign keys
    await db.clearTable('users', { disableForeignKeys: true });
  } else if (error.message.includes('does not exist')) {
    console.log('Table tidak ditemukan');
  }
}
```

## 📊 Architecture

```
┌────────────────────────────────────────────────────┐
│                  Your Application                  │
├────────────────────────────────────────────────────┤
│        @renpwn/termux-sqlite3 (JavaScript)         │
├─────────┬─────────┬──────────┬──────────┬──────────┤
│ Engine  │Statement│ Cursor   │Transaction│  Lib    │
├─────────┼─────────┼──────────┼──────────┼──────────┤
│ Process │ Query   │ Chunking │ Savepoints│ Binding │
│ Pool    │ Parsing │ Adaptive │ Retry     │ Debug   │
│ Timeout │ Binding │ Memory   │ Isolation │ Memory  │
│ Clear*  │ Columns │ Iteration│ Batch     │ Explain │
└─────────┴─────────┴──────────┴──────────┴──────────┘
                          │
                    JSON Streaming
                          │
┌─────────────────────────────────────────────────────┐
│              sqlite3 CLI (Termux Process)           │
├─────────────────────────────────────────────────────┤
│                 SQLite Database File                │
└─────────────────────────────────────────────────────┘
```

*Fitur baru: `clearTable()`, `clearAllTables()`, `resetDatabase()`

## 🧪 Testing dan Development

```bash
# Clone repository
git clone https://github.com/renpwn/termux-sqlite3.git
cd termux-sqlite3

# Instal dependencies development
npm install

# Jalankan tests
npm test

# Jalankan benchmark
npm run benchmark

# Lint code
npm run lint

# Format code
npm run format

# Generate documentation
npm run build:docs

# Security audit
npm run security

# Code coverage
npm run coverage

# Test data management functions
node test-clear-tables.js
```

## 🤝 Berkontribusi

Kontribusi sangat diterima! Berikut cara berkontribusi:

1. **Fork** repository ini
2. **Buat branch fitur** baru:
   ```bash
   git checkout -b fitur/amazing-feature
   ```
3. **Commit** perubahan Anda:
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push** ke branch tersebut:
   ```bash
   git push origin fitur/amazing-feature
   ```
5. **Buat Pull Request** melalui GitHub

## 📄 Lisensi

Proyek ini dilisensikan di bawah MIT License - lihat file LICENSE untuk detail.

## 🙏 Acknowledgements

* **SQLite** - Database engine yang luar biasa
* **Termux** - Terminal emulator untuk Android
* **better-sqlite3** - Inspirasi utama untuk desain API
* **Node.js Community** - Untuk ekosistem yang luar biasa

## 📞 Support

Jika Anda menemukan bug atau memiliki pertanyaan:

1. Buka Issue di [GitHub Issues](https://github.com/renpwn/termux-sqlite3/issues)
2. Cek Dokumentasi untuk contoh penggunaan
3. Gunakan Tag [termux-sqlite3] di Stack Overflow

---

**Dibuat dengan ❤️ untuk komunitas Termux**

"Membawa pengembangan database SQLite ke perangkat mobile tanpa batas kompilasi native"