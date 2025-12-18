# termux-sqlite3

![Termux](https://img.shields.io/badge/Termux-Android-00B0F0?style=for-the-badge&logo=android)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

`termux-sqlite3` adalah wrapper SQLite berbasis JavaScript murni (JS-only) yang dirancang khusus untuk lingkungan **Termux** di Android.

termux-sqlite3 adalah wrapper SQLite berbasis JavaScript murni (JS-only) yang dirancang khusus untuk lingkungan Termux di Android. Library ini memberikan pengalaman pengembangan yang serupa dengan better-sqlite3, namun tanpa memerlukan proses kompilasi modul binari (native addons) yang seringkali sulit dilakukan di perangkat seluler.

Library ini bekerja dengan melakukan spawning terhadap proses sqlite3 sistem dan berkomunikasi melalui antarmuka JSON yang efisien.

## âœ¨ Fitur Utama

* **ðŸš« Zero Native Dependencies:** Tidak memerlukan `node-gyp`, Python, atau kompilasi C++; hanya membutuhkan binary `sqlite3` terinstal di Termux.
* **ðŸ“š API Mirip Better-sqlite3:** Menggunakan pola `prepare()`, `get()`, dan `all()` yang familiar.
* **ðŸ’¾ Manajemen Memori Pintar:** Dilengkapi dengan sistem cursor yang menyesuaikan ukuran pengambilan data (*chunk size*) secara dinamis berdasarkan penggunaan RAM.
* **ðŸ”’ Transaksi Terintegrasi:** Dukungan bawaan untuk transaksi atomik dengan *automatic rollback* jika terjadi kesalahan.
* **ðŸ›¡ï¸ SQL Binding Aman:** Mencegah SQL Injection dengan sistem binding parameter menggunakan sintaks `:key` atau `?`.
* **ðŸ” Query Plan Analysis:** Memudahkan optimasi query dengan fitur `explain()`.
* **âš¡ Performa Optimal:** Menggunakan JSON streaming untuk komunikasi yang efisien dengan proses SQLite.
* **ðŸ”„ Connection Pooling:** Mendukung multiple connections untuk *concurrent queries*.


## ðŸ“‹ Prasyarat

* **Termux** (Disarankan versi [F-Droid](https://f-droid.org/en/packages/com.termux/) untuk update terbaru)
* **Node.js** (Versi 14 atau yang lebih baru)
* **SQLite3 Binary** (Terinstal di sistem Termux)


## ðŸš€ Instalasi

1. Instal Dependensi di Termux

```bash
# Update package list
pkg update

# Instal SQLite3 dan Node.js
pkg install sqlite nodejs -y

# Verifikasi instalasi
sqlite3 --version
node --version
```

2. Instal Library termux-sqlite3

```bash
# Instal dari GitHub (rekomendasi untuk versi terbaru)
npm install https://github.com/renpwn/termux-sqlite3

# Atau jika tersedia di npm registry
npm install termux-sqlite3
```

## ðŸ“– Quick Start

Inisialisasi Database

```javascript
const Database = require('termux-sqlite3');

// Buka koneksi database (file akan dibuat jika tidak ada)
const db = new Database('myapp.db');

// Dengan opsi tambahan
const db2 = new Database('myapp.db', {
  timeout: 10000,           // Timeout 10 detik per query
  poolSize: 2,              // 2 koneksi paralel
  busyTimeout: 10000,       // Tunggu 10 detik jika database locked
  adaptiveChunking: true    // Aktifkan adaptive memory management
});

// Event listener untuk error handling
db.on('error', (err) => {
  console.error('Database Error:', err.message);
});

db.on('closed', () => {
  console.log('Database connection closed');
});
```

Membuat Tabel dan Operasi Dasar

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

// Menambahkan data
const result = await db.run(
  'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
  ['John Doe', 'john@example.com', 25]
);
console.log(`ID baru: ${result.lastInsertRowid}`);

// Query data
const user = await db.get(
  'SELECT * FROM users WHERE id = ?',
  [1]
);
console.log('User ditemukan:', user);

// Update data
await db.run(
  'UPDATE users SET age = ? WHERE email = ?',
  [26, 'john@example.com']
);

// Delete data
await db.run(
  'DELETE FROM users WHERE age < ?',
  [18]
);
```

## ðŸ› ï¸ API Reference Lengkap

### Kelas Database

#### `new Database(filename, options)`
Membuka koneksi ke database SQLite.

**Parameter:**
* **`filename`** (String): Path ke file database.
* **`options`** (Object, opsional):
    * **`timeout`** (Number): Timeout query dalam ms (default: `5000`).
    * **`poolSize`** (Number): Jumlah koneksi paralel (default: `1`).
    * **`busyTimeout`** (Number): Waktu tunggu saat database locked (default: `5000`).
    * **`adaptiveChunking`** (Boolean): Aktifkan adaptive memory (default: `true`).

**Contoh:**

```javascript
const db = new Database('/data/data/com.termux/files/home/myapp.db', {
  timeout: 15000,
  poolSize: 3
});
```

db.prepare(sql)

Membuat prepared statement untuk eksekusi berulang.

Contoh:

```javascript
const stmt = db.prepare('SELECT * FROM users WHERE email = :email');
const user = await stmt.get({ email: 'test@example.com' });
```

db.exec(sql)

Menjalankan perintah SQL tanpa mengembalikan hasil (untuk DDL, INSERT, UPDATE, DELETE).

Contoh:

```javascript
await db.exec('CREATE INDEX idx_users_email ON users(email)');
```

db.transaction(fn, options)

Menjalankan blok kode dalam transaksi.

Contoh:

```javascript
await db.transaction(async () => {
  await db.run('INSERT INTO accounts (balance) VALUES (100)');
  await db.run('INSERT INTO transactions (amount) VALUES (100)');
});
```

db.pragma(name, value)

Mengakses atau mengatur pragma SQLite.

Contoh:

```javascript
const version = await db.pragma('sqlite_version');
await db.pragma('journal_mode', 'WAL');
```

db.close()

Menutup koneksi database.

Contoh:

```javascript
await db.close();
```

Kelas Statement

stmt.all(params)

Mengembalikan semua baris hasil query.

Contoh:

```javascript
const users = await stmt.all({ status: 'active' });
```

stmt.get(params)

Mengembalikan baris pertama hasil query.

Contoh:

```javascript
const user = await stmt.get({ id: 1 });
```

stmt.run(params)

Menjalankan statement (INSERT, UPDATE, DELETE) dan mengembalikan metadata.

Contoh:

```javascript
const result = await stmt.run({ name: 'Alice', age: 30 });
console.log(`Changes: ${result.changes}, Last ID: ${result.lastInsertRowid}`);
```

stmt.iterate(options)

Mengembalikan async generator untuk iterasi data besar.

Contoh:

```javascript
for await (const row of stmt.iterate({ chunk: 'auto' })) {
  processRow(row);
}
```

stmt.explain(params)

Menjalankan EXPLAIN QUERY PLAN pada statement.

Contoh:

```javascript
const plan = await stmt.explain();
console.log('Query Plan:', plan);
```

## ðŸ”„ Iterasi Data Besar dengan Cursor

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
```

## ðŸ’° Manajemen Transaksi

Transaksi Sederhana

```javascript
await db.transaction(async () => {
  await db.run('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
  await db.run('UPDATE accounts SET balance = balance + 100 WHERE id = 2');
});
```

Transaksi dengan Isolation Level

```javascript
await db.transaction(async () => {
  // Operasi database
}, { isolationLevel: 'IMMEDIATE' });
```

Savepoints (Nested Transactions)

```javascript
await db.transaction(async (tx) => {
  const sp1 = await tx.savepoint();
  
  try {
    await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
    await tx.release(sp1);
  } catch (err) {
    await tx.rollbackTo(sp1);
  }
}, { savepoints: true });
```

Batch Operations

```javascript
const operations = [
  "DELETE FROM temp_data",
  "INSERT INTO logs (action) VALUES ('cleanup')",
  async () => {
    await db.run("VACUUM");
  }
];

await db.transaction.batch(db, operations, {
  isolationLevel: 'EXCLUSIVE',
  retries: 3
});
```

ðŸ” Debugging dan Optimasi

Aktifkan Debug Mode

```javascript
const { enableDebug } = require('termux-sqlite3/debug');
enableDebug(true); // Semua query akan dicetak ke console.error
```

Analisis Query Performance

```javascript
const stmt = db.prepare('SELECT * FROM users WHERE age > :age');
const explain = await stmt.explain({ age: 18 });
console.log('Query Plan:', explain);
```

Database Maintenance

```javascript
// Optimasi database
await db.vacuum();

// WAL checkpoint
await db.checkpoint('PASSIVE');

// Backup database
await db.backup('/sdcard/backup.db');
```

## ðŸ“Š Contoh Aplikasi Lengkap

Aplikasi To-Do List

```javascript
const Database = require('termux-sqlite3');

class TodoApp {
  constructor() {
    this.db = new Database('todos.db');
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
  }

  async addTask(title, description = '', priority = 1) {
    const result = await this.db.run(
      'INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)',
      [title, description, priority]
    );
    return result.lastInsertRowid;
  }

  async completeTask(id) {
    await this.db.run(
      'UPDATE tasks SET completed = 1 WHERE id = ?',
      [id]
    );
  }

  async getPendingTasks() {
    return this.db.all(
      'SELECT * FROM tasks WHERE completed = 0 ORDER BY priority DESC'
    );
  }

  async getStats() {
    return this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(completed) as done,
        AVG(priority) as avg_priority
      FROM tasks
    `);
  }

  async close() {
    await this.db.close();
  }
}

// Penggunaan
async function main() {
  const app = new TodoApp();
  await app.init();
  
  await app.addTask('Belajar Termux', 'Pelajari termux-sqlite3', 3);
  await app.addTask('Buat aplikasi', 'Buat aplikasi database', 2);
  
  const tasks = await app.getPendingTasks();
  console.log(`Ada ${tasks.length} tugas pending`);
  
  const stats = await app.getStats();
  console.log(`Statistik: ${stats.done}/${stats.total} selesai`);
  
  await app.close();
}

main().catch(console.error);
```

Aplikasi Logging dengan Cursor

```javascript
const Database = require('termux-sqlite3');
const fs = require('fs');

class Logger {
  constructor() {
    this.db = new Database('logs.db');
  }

  async init() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');
  }

  async log(level, message) {
    await this.db.run(
      'INSERT INTO logs (level, message) VALUES (?, ?)',
      [level, message]
    );
  }

  async exportLogs(startDate, endDate, outputFile) {
    const stmt = this.db.prepare(`
      SELECT * FROM logs 
      WHERE timestamp BETWEEN :start AND :end
      ORDER BY timestamp DESC
    `);
    
    const writeStream = fs.createWriteStream(outputFile);
    
    for await (const log of stmt.iterate({
      chunk: 1000,
      params: { start: startDate, end: endDate }
    })) {
      writeStream.write(`${log.timestamp} [${log.level}] ${log.message}\n`);
    }
    
    writeStream.end();
  }
}

// Penggunaan
async function loggingExample() {
  const logger = new Logger();
  await logger.init();
  
  // Generate sample logs
  for (let i = 0; i < 10000; i++) {
    await logger.log(
      i % 3 === 0 ? 'ERROR' : 'INFO',
      `Log entry ${i} - ${new Date().toISOString()}`
    );
  }
  
  // Export logs with memory-efficient cursor
  await logger.exportLogs(
    '2024-01-01',
    '2024-12-31',
    '/sdcard/logs_export.txt'
  );
  
  console.log('Log export completed!');
}

loggingExample();
```

## âš¡ Performance Tips

1. Gunakan Prepared Statement untuk Query Berulang

```javascript
// âœ… BENAR: Gunakan prepared statement
const stmt = db.prepare('INSERT INTO data (value) VALUES (?)');
for (const value of largeArray) {
  await stmt.run([value]);
}

// âŒ SALAH: Hindari re-prepare setiap iterasi
for (const value of largeArray) {
  await db.run('INSERT INTO data (value) VALUES (?)', [value]);
}
```

2. Gunakan Transaction untuk Batch Operations

```javascript
// âœ… BENAR: Gunakan transaction untuk bulk insert
await db.transaction(async () => {
  for (const item of items) {
    await db.run('INSERT INTO products (name, price) VALUES (?, ?)', 
      [item.name, item.price]);
  }
});

// âŒ SALAH: Hindari autocommit setiap insert
for (const item of items) {
  await db.run('INSERT INTO products (name, price) VALUES (?, ?)', 
    [item.name, item.price]);
}
```

3. Pilih Chunk Size yang Tepat

```javascript
// Untuk perangkat dengan RAM kecil (< 2GB)
for await (const row of stmt.iterate({ chunk: 100 })) { }

// Untuk perangkat dengan RAM besar (> 4GB)
for await (const row of stmt.iterate({ chunk: 5000 })) { }

// Biarkan library memutuskan
for await (const row of stmt.iterate({ chunk: 'auto' })) { }
```

## ðŸ› Troubleshooting

Masalah Umum dan Solusi

Error: "sqlite3: command not found"

```bash
# Solusi: Instal sqlite3 di Termux
pkg install sqlite
```

Error: "database is locked"

```javascript
// Solusi 1: Tingkatkan busyTimeout
const db = new Database('app.db', { busyTimeout: 15000 });

// Solusi 2: Gunakan transaction dengan retry
await db.transaction(async () => {
  // operasi database
}, { retries: 3 });
```

Error: "out of memory"

```javascript
// Solusi 1: Kurangi chunk size
for await (const row of stmt.iterate({ chunk: 50 })) { }

// Solusi 2: Aktifkan adaptive chunking
for await (const row of stmt.iterate({ chunk: 'adaptive' })) { }

// Solusi 3: Bersihkan memory Node.js secara periodic
if (rowCount % 1000 === 0) {
  await new Promise(resolve => setTimeout(resolve, 100));
  if (global.gc) global.gc();
}
```

Error: "Cannot open database file"

```javascript
// Solusi: Gunakan path absolut
const db = new Database('/data/data/com.termux/files/home/myapp.db');
```

Performance Lambat

```javascript
// Optimasi SQLite settings
await db.pragma('journal_mode = WAL');
await db.pragma('synchronous = NORMAL');
await db.pragma('cache_size = 2000');
await db.pragma('temp_store = MEMORY');
```

## ðŸ“Š Perbandingan dengan Library Lain

| Fitur | termux-sqlite3 | better-sqlite3 | sqlite3 (npm) |
| :--- | :--- | :--- | :--- |
| **Kompatibilitas Termux** | âœ… Tanpa kompilasi | âŒ Butuh kompilasi native | âŒ Butuh kompilasi native |
| **API Style** | Async/Promise | Sync | Callback/Promise |
| **Memory Management** | âœ… Adaptive chunking | âœ… Native | âš ï¸ Manual |
| **Transaction Support** | âœ… Full + Savepoints | âœ… Full | âœ… Basic |
| **Zero Native Build** | âœ… 100% JS | âŒ Native addon | âŒ Native addon |
| **Performance** | âš¡ Baik (JSON Stream) | âš¡ Sangat Baik | âš¡ Baik |

---

## ðŸ¤ Berkontribusi

Kontribusi sangat diterima! Berikut cara berkontribusi:

1. **Fork** repository ini.
2. **Buat branch fitur** baru:
   ```bash
   git checkout -b fitur/amazing-feature

 * Commit perubahan Anda:
   git commit -m 'Add amazing feature'

 * Push ke branch tersebut:
   git push origin fitur/amazing-feature

 * Buat Pull Request melalui GitHub.
<!-- end list -->

---

Development Setup

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
```

---

ðŸ“„ Lisensi

Proyek ini dilisensikan di bawah MIT License - lihat file LICENSE untuk detail.

## ðŸ™ Acknowledgements

* **SQLite** - Database engine yang luar biasa.
* **Termux** - Terminal emulator untuk Android.
* **better-sqlite3** - Inspirasi utama untuk desain API.

ðŸ“ž Support

Jika Anda menemukan bug atau memiliki pertanyaan:

1. Buka Issue di GitHub Issues
2. Cek Dokumentasi untuk contoh penggunaan
3. Gunakan Tag [termux-sqlite3] di Stack Overflow

---

Dibuat dengan â¤ï¸ untuk komunitas Termux

"Membawa pengembangan database SQLite ke perangkat mobile tanpa batas kompilasi native"
