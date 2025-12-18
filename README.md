termux-sqlite3 adalah wrapper SQLite berbasis JavaScript murni (JS-only) yang dirancang khusus untuk lingkungan Termux di Android. Library ini memberikan pengalaman pengembangan yang serupa dengan better-sqlite3, namun tanpa memerlukan proses kompilasi modul binari (native addons) yang seringkali sulit dilakukan di perangkat seluler.
Library ini bekerja dengan melakukan spawning terhadap proses sqlite3 sistem dan berkomunikasi melalui antarmuka JSON.
✨ Fitur Utama
 * Zero Native Dependencies: Tidak memerlukan node-gyp atau kompilasi C++; hanya membutuhkan binary sqlite3 terinstal di Termux Anda.
 * API Mirip Better-sqlite3: Menggunakan pola prepare(), get(), dan all() yang familiar.
 * Manajemen Memori Pintar: Dilengkapi dengan sistem cursor yang menyesuaikan ukuran pengambilan data (chunk size) secara dinamis berdasarkan penggunaan RAM perangkat.
 * Transaksi Terintegrasi: Dukungan bawaan untuk transaksi atomik dengan automatic rollback jika terjadi kesalahan.
 * SQL Binding Aman: Mencegah SQL Injection dengan sistem binding parameter menggunakan sintaks :key.
 * Query Plan Analysis: Memudahkan optimasi query dengan fitur explain().
🚀 Instalasi
Pastikan Anda telah menginstal sqlite3 di dalam Termux:
pkg install sqlite-utils

Lalu pasang library ini di proyek Node.js Anda:
npm install renpwn/termux-sqlite3

📖 Contoh Penggunaan
Inisialisasi Database
const Database = require('termux-sqlite3');
const db = new Database('data.db'); //

Query Dasar (Prepare, Get, All)
// Mengambil banyak data
const users = await db.prepare("SELECT * FROM users WHERE status = :status")
                      .all({ status: 'active' });

// Mengambil satu data
const user = await db.prepare("SELECT * FROM users WHERE id = :id")
                     .get({ id: 1 });

Iterasi Data Besar (Cursor)
Untuk menghemat RAM, gunakan generator iterate() yang secara otomatis mengatur chunking data:
const stmt = db.prepare("SELECT * FROM big_table ORDER BY id ASC");

for await (const row of stmt.iterate({ chunk: 'auto' })) {
  console.log(row);
}

Transaksi
await db.transaction(async () => {
  await db.exec("INSERT INTO logs (msg) VALUES ('test')");
  // Jika terjadi error di sini, semua perubahan otomatis di-rollback
});

🛠️ API Reference
 * new Database(filename): Membuka koneksi database.
 * db.prepare(sql): Membuat objek Statement.
 * db.exec(sql): Menjalankan SQL mentah secara asinkron.
 * stmt.all(params): Mengembalikan semua baris hasil query.
 * stmt.get(params): Mengembalikan satu baris pertama.
 * stmt.iterate(options): Mengembalikan generator untuk iterasi hemat memori.
 * stmt.explain(): Menjalankan EXPLAIN QUERY PLAN pada query tersebut.
⚠️ Batasan
Karena library ini berkomunikasi melalui sub-process CLI sqlite3:
 * Semua operasi bersifat Asinkron (mengembalikan Promise), berbeda dengan better-sqlite3 asli yang sinkron.
 * Performa mungkin sedikit di bawah modul native jika menangani jutaan operasi tulis kecil secara repetitif di luar transaksi.
📄 Lisensi
Proyek ini dilisensikan di bawah MIT License.
Apakah Anda ingin saya menambahkan bagian "Troubleshooting" untuk masalah umum di Termux atau bagian "Performance Tips"?

