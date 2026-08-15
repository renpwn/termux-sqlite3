# @renpwn/termux-sqlite3

![Termux](https://img.shields.io/badge/Termux-Android-00B0F0?logo=android)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs)
![npm version](https://img.shields.io/npm/v/@renpwn/termux-sqlite3)
![npm downloads](https://img.shields.io/npm/dm/@renpwn/termux-sqlite3)
![license](https://img.shields.io/npm/l/@renpwn/termux-sqlite3)
![last commit](https://img.shields.io/github/last-commit/renpwn/termux-sqlite3)
![repo size](https://img.shields.io/github/repo-size/renpwn/termux-sqlite3)
![types](https://img.shields.io/npm/types/@renpwn/termux-sqlite3)

`@renpwn/termux-sqlite3` adalah wrapper SQLite berbasis JavaScript murni (JS-only) yang dirancang khusus untuk lingkungan **Termux** di Android. Library ini memberikan pengalaman pengembangan yang serupa dengan `better-sqlite3`, namun tanpa memerlukan proses kompilasi modul binari (native addons) yang seringkali sulit dilakukan di perangkat seluler.

Library ini bekerja dengan melakukan spawning terhadap proses `sqlite3` sistem dan berkomunikasi melalui antarmuka JSON streaming yang efisien.

## ✨ Fitur Utama

* **🚫 Zero Native Dependencies:** Tidak memerlukan `node-gyp`, Python, atau toolchain C++; hanya membutuhkan binary `sqlite3` terinstal di Termux.
* **📚 API Mirip Better-sqlite3:** Menggunakan pola `prepare()`, `get()`, `all()`, `run()`, dan `transaction()`.
* **💾 Manajemen Memori Pintar:** Dilengkapi dengan sistem cursor adaptif yang menyesuaikan ukuran pengambilan data (*chunk size*) secara dinamis berdasarkan penggunaan RAM.
* **🔒 Transaksi Terintegrasi:** Dukungan bawaan untuk transaksi atomik dengan *savepoints*, *automatic rollback*, dan retry otomatis.
* **🛡️ SQL Binding Aman & Lengkap:** Mencegah SQL Injection dengan sistem tokenized binding parameter `:key` atau `?`, termasuk dukungan data teks, angka, boolean, JSON, dan `Buffer` (BLOB).
* **🔍 Query Plan Analysis:** Memudahkan optimasi query dengan fitur `explain()`.
* **⚡ Performa Optimal & Stabil:** Menggunakan JSON streaming dengan dynamic query sentinel unik dan connection pooling.
* **📦 Split & Rebuild Database:** Memecah database besar menjadi beberapa part untuk didistribusikan via Git / npm tanpa Git LFS.
* **🧩 Desain Termux-first:** Dibuat dan diuji langsung untuk lingkungan Android Termux.

## 📋 Prasyarat

* **Termux** (Disarankan versi [F-Droid](https://f-droid.org/en/packages/com.termux/))
* **Node.js** (Versi 14 atau yang lebih baru)
* **SQLite3 Binary** (Terinstal di sistem Termux)

## 🚀 Instalasi

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

2. Instal Library

```bash
npm install @renpwn/termux-sqlite3
```

## 📖 Quick Start

Inisialisasi Database

```javascript
const Database = require('@renpwn/termux-sqlite3');

// Buka koneksi database (file akan dibuat jika tidak ada)
const db = new Database('myapp.db');

// Dengan opsi tambahan
const db2 = new Database('myapp.db', {
  timeout: 10000,           // Timeout 10 detik per query
  poolSize: 1,              // Pool size koneksi
  busyTimeout: 10000        // Tunggu 10 detik jika database locked
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

## 🛠️ API Reference Lengkap

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

Membuat fungsi transaksi yang dapat dipanggil (transaction executor) atau dijalankan langsung.

Contoh:

```javascript
// Pola 1: Membuat fungsi transaksi (better-sqlite3 style)
const transferMoney = db.transaction(async (fromId, toId, amount) => {
  await db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, fromId]);
  await db.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, toId]);
});

// Eksekusi transaksi
await transferMoney(1, 2, 100);

// Pola 2: Eksekusi langsung
await db.transaction(async () => {
  await db.run('INSERT INTO accounts (balance) VALUES (100)');
  await db.run('INSERT INTO transactions (amount) VALUES (100)');
})();
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
## 📦 Split & Rebuild Database (Dukungan SQLite Ukuran Besar)

Library ini mendukung pemecahan (split) file database SQLite berukuran
besar agar bisa dengan aman: - di-commit ke GitHub - dipublish ke npm -
didistribusikan tanpa Git LFS

### Prinsip Desain

-   Split hanya saat build-time\
-   Rebuild otomatis saat runtime\
-   Performa SQLite tidak terpengaruh

---

## 🔹 Memecah Database (Build-Time)

Split dilakukan setelah database final & ditutup.

``` js
const { splitDatabase } = require('@renpwn/termux-sqlite3/lib/splitter')

splitDatabase('seed.db', {
  partSizeMB: 8
})
```

Output:

    seed.db.part01
    seed.db.part02
    seed.db.part03
    seed.db.manifest.json

---

## 🔹 File Manifest

``` json
{
  "name": "seed.db",
  "parts": 3,
  "size": 28491776,
  "checksum": {
    "algo": "sha256",
    "value": "..."
  }
}
```

---

## 🔹 Rebuild Otomatis (Runtime)

``` js
const db = new Database('seed.db', {
  split: {
    enabled: true
  }
})
```

---

## 🔹 Split Saat db.close() (Opsional)

``` js
const db = new Database('seed.db', {
  split: {
    enabled: true,
    splitOnClose: true,
    partSizeMB: 8
  }
})

await db.close()
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
```

## 💰 Manajemen Transaksi

Transaksi Sederhana

```javascript
const updateBalances = db.transaction(async (user1, user2, amount) => {
  await db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, user1]);
  await db.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, user2]);
});

await updateBalances(1, 2, 100);
```

Transaksi dengan Isolation Level

```javascript
const immediateTrx = db.transaction(async () => {
  // Operasi database
}, { isolationLevel: 'IMMEDIATE' });

await immediateTrx();
```

Savepoints (Nested Transactions)

```javascript
const complexTx = db.transaction(async (tx) => {
  const sp1 = await tx.savepoint();
  
  try {
    await db.run('INSERT INTO users (name) VALUES (?)', ['Alice']);
    await tx.release(sp1);
  } catch (err) {
    await tx.rollbackTo(sp1);
  }
}, { savepoints: true });

await complexTx();
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

## 🔍 Debugging dan Optimasi

Aktifkan Debug Mode

```javascript
const { enableDebug } = require('@renpwn/termux-sqlite3/debug');
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

## 📊 Contoh Aplikasi Lengkap

Aplikasi To-Do List

```javascript
const Database = require('@renpwn/termux-sqlite3');

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
const Database = require('@renpwn/termux-sqlite3');
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

## ⚡ Performance Tips

1. Gunakan Prepared Statement untuk Query Berulang

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

2. Gunakan Transaction untuk Batch Operations

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

3. Pilih Chunk Size yang Tepat

```javascript
// Untuk perangkat dengan RAM kecil (< 2GB)
for await (const row of stmt.iterate({ chunk: 100 })) { }

// Untuk perangkat dengan RAM besar (> 4GB)
for await (const row of stmt.iterate({ chunk: 5000 })) { }

// Biarkan library memutuskan
for await (const row of stmt.iterate({ chunk: 'auto' })) { }
```

## 🐛 Troubleshooting

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

## 📊 Perbandingan dengan Library Lain

| Fitur | termux-sqlite3 | better-sqlite3 | sqlite3 (npm) |
| :--- | :--- | :--- | :--- |
| **Kompatibilitas Termux** | ✅ Tanpa kompilasi | ❌ Butuh kompilasi native | ❌ Butuh kompilasi native |
| **API Style** | Async/Promise | Sync | Callback/Promise |
| **Memory Management** | ✅ Adaptive chunking | ✅ Native | ⚠️ Manual |
| **Transaction Support** | ✅ Full + Savepoints | ✅ Full | ✅ Basic |
| **Zero Native Build** | ✅ 100% JS | ❌ Native addon | ❌ Native addon |
| **Performance** | ⚡ Baik (JSON Stream) | ⚡ Sangat Baik | ⚡ Baik |

---

## 🤝 Berkontribusi

Kontribusi sangat diterima! Berikut cara berkontribusi:

1. **Fork** repository ini.
2. **Buat branch fitur** baru:
   ```bash
   git checkout -b fitur/amazing-feature
   ```
3. **Commit perubahan Anda**:
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push ke branch**:
   ```bash
   git push origin fitur/amazing-feature
   ```
5. **Buat Pull Request** melalui GitHub.

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

## 📄 Lisensi

MIT © renpwn - **Ardy Rendra R**

---

## 🙏 Acknowledgements

* **SQLite** - Database engine yang luar biasa.
* **Termux** - Terminal emulator untuk Android.
* **better-sqlite3** - Inspirasi utama untuk desain API.

📞 Support

Jika Anda menemukan bug atau memiliki pertanyaan:

1. Buka Issue di GitHub Issues
2. Cek Dokumentasi untuk contoh penggunaan
3. Gunakan Tag [termux-sqlite3] di Stack Overflow

---

Dibuat dengan ❤️ untuk komunitas Termux

"Membawa pengembangan database SQLite ke perangkat mobile tanpa batas kompilasi native"

---

## 🙌 Support the Author

If this project helps you or saves you time, your support is greatly appreciated 🙏

### ⭐ Star the repo
[![GitHub Stars](https://img.shields.io/github/stars/renpwn/termux-sqlite3?style=flat&logo=github&color=gray)](https://github.com/renpwn/termux-sqlite3)

### 📺 Content & Community
[![YouTube](https://img.shields.io/badge/YouTube-Subscribe-FF0000?style=flat&logo=youtube&logoColor=white)](https://youtube.com/@renpwn)

### 🛒 Marketplace & Social Commerce
[![TikTok](https://img.shields.io/badge/TikTok-Account%20%26%20Shop-25F4EE?style=flat&logo=tiktok&logoColor=black)](https://www.tiktok.com/@renpwn)
[![Shopee](https://img.shields.io/badge/Shopee-Store-EE4D2D?style=flat&logo=shopee&logoColor=white)](https://shopee.co.id/renpwn)
[![Tokopedia](https://img.shields.io/badge/Tokopedia-Store-03AC0E?style=flat&logo=tokopedia&logoColor=white)](https://www.tokopedia.com/renpwn)

### ☕ Personal Support
[![PayPal](https://img.shields.io/badge/PayPal-Donate-0070BA?style=flat&logo=paypal&logoColor=white)](https://paypal.me/ArdyRendra)
[![Saweria](https://img.shields.io/badge/Saweria-Support-FFB000?style=flat)](https://saweria.co/renpwn)
[![Trakteer](https://img.shields.io/badge/Trakteer-Support-FF6F00?style=flat)](https://trakteer.id/renpwn)
