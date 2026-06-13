# Ledgerly Bot WhatsApp 🤖

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

Bot WhatsApp resmi untuk **[Ledgerly](https://ledgerly.my.id)** — sistem manajemen inventaris & keuangan UMKM. Bot ini terhubung langsung ke database Supabase Cloud Ledgerly untuk mengirim **peringatan stok rendah otomatis** ke pemilik toko, serta menyediakan **perintah interaktif** untuk cek stok & ringkasan keuangan lewat chat.

> Repositori ini **terpisah** dari aplikasi web Ledgerly (vanilla HTML/CSS/JS + Vite). Bot di-host di **Pterodactyl Panel** sebagai proses Node.js yang berjalan terus-menerus.

---

## ✨ Fitur

* **🔔 Peringatan Stok Rendah Otomatis** — Memindai stok produk secara berkala (default tiap 10 menit). Jika ada produk di bawah batas minimum (*reorder point*), bot mengirim chat peringatan ke nomor WhatsApp pemilik toko. Anti-spam: tidak mengirim ulang kecuali jumlah stok berubah (state disimpan di `sent_alerts.json`).
* **💬 Perintah Interaktif** — Pemilik toko bisa tanya data lewat chat pribadi:
  | Perintah | Fungsi |
  | :--- | :--- |
  | `/stok` | Daftar produk yang stoknya di bawah batas minimum |
  | `/ringkasan` (`/keuangan`) | Omzet, modal terpakai, & laba kotor hari ini |
  | `/menu` (`/help`, `/start`) | Tampilkan daftar perintah |
  | `/ping` | Tes respons bot |
* **🔒 Gating per Paket** — Hanya pemilik paket **Profesional / Enterprise** yang bisa memakai bot. Pengguna paket Starter diarahkan untuk upgrade.
* **🟢 Status Gateway Real-Time** — Bot mengirim *heartbeat* (ping) ke tabel `Platform_Settings` setiap 30 detik, sehingga Dashboard Superadmin di web menampilkan status **"WhatsApp Gateway: Aktif"** saat bot berjalan.
* **🔐 Login Pairing Code** — Tautkan nomor bot tanpa scan QR (pakai kode 8 digit). QR Code tersedia sebagai fallback.

---

## 🛠️ Tech Stack

* **Runtime**: Node.js (ESM, `>=18`)
* **WhatsApp**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) (multi-file auth state)
* **Database**: [@supabase/supabase-js](https://supabase.com) (service_role key, server-side)
* **Utilitas**: `pino` (logger), `chalk` + `figlet` (CLI), `qrcode-terminal`, `dotenv`

---

## 📂 Struktur Proyek

```
bot-wa/
├── index.js              # Entry point: koneksi Baileys, pairing, routing command, loop ping & alert
├── settings.js           # Baca & validasi konfigurasi dari .env
├── lib/
│   ├── utils.js          # Helper: normalisasi nomor HP, JID, format rupiah, timestamp WIB
│   └── supabase.js       # Query DB: user by phone, produk kritis, stats harian, ping gateway
├── commands/
│   ├── stok.js           # Handler /stok & /menu
│   ├── summary.js        # Handler /ringkasan (/keuangan)
│   └── alerts.js         # Background job pemindai stok rendah + anti-spam cache
├── .env.example          # Template variabel lingkungan
├── .gitignore            # Mengecualikan .env, .auth_sessions, node_modules, dll
└── package.json
```

---

## 🚀 Cara Menjalankan

### Prasyarat
* Node.js `>=18`
* Service Role Key dari proyek Supabase Ledgerly

### Langkah

1. **Clone & install dependensi:**
   ```bash
   git clone https://github.com/rohidrivaldi/Ledgerly-bot-wa.git
   cd Ledgerly-bot-wa
   npm install
   ```

2. **Siapkan environment:**
   ```bash
   cp .env.example .env
   ```
   Lalu isi `.env`:
   ```env
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role_key_rahasia>
   BOT_NAME=Ledgerly-Bot
   SESSION_PATH=.auth_sessions
   CHECK_INTERVAL_MS=600000
   ```
   > ⚠️ Gunakan **service_role key** (bukan anon/publishable) agar bot bisa membaca data semua toko. Key ini rahasia — jangan pernah di-commit (sudah dilindungi `.gitignore`).

3. **Jalankan bot:**
   ```bash
   npm start
   ```

4. **Pairing nomor WhatsApp:**
   * Terminal meminta nomor WhatsApp bot (mis. `628123456789` atau `08123456789`).
   * Setelah beberapa detik muncul **Pairing Code** 8 digit (mis. `A2BC-4D5E`).
   * Di HP: **WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon** → masukkan kode.
   * Tunggu hingga muncul log hijau `✅ Bot WhatsApp berhasil terhubung!`.

   Sesi tersimpan di folder `.auth_sessions/`, jadi restart berikutnya tidak perlu pairing ulang.

---

## ⚙️ Variabel Lingkungan

| Variabel | Wajib | Default | Keterangan |
| :--- | :---: | :--- | :--- |
| `SUPABASE_URL` | ✅ | — | URL proyek Supabase Ledgerly |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role key (rahasia, server-side) |
| `BOT_NAME` | — | `Ledgerly-Bot` | Nama bot di log |
| `SESSION_PATH` | — | `.auth_sessions` | Lokasi penyimpanan sesi Baileys |
| `CHECK_INTERVAL_MS` | — | `600000` | Interval pemindaian stok rendah (ms) |

---

## ☁️ Deploy ke Pterodactyl Panel

1. Buat server bertipe **Node.js** di Pterodactyl.
2. Upload kode (atau pull dari repo ini), set startup command ke `node index.js`.
3. Tambahkan variabel lingkungan di tab **Startup / Variables** panel (jangan upload `.env` manual).
4. Jalankan server, lalu lakukan pairing lewat **Console** panel (masukkan nomor + pairing code seperti langkah di atas).
5. Aktifkan **auto-restart** agar bot otomatis menyambung kembali jika koneksi terputus.

---

## 🔗 Integrasi dengan Ledgerly Web

Bot membaca/menulis tabel Supabase yang sama dengan aplikasi web:

* **`Users`** — mencocokkan nomor WhatsApp pengirim (`noTelp`) ke pemilik toko + cek paket.
* **`Kategori` + `Products`** — menentukan produk milik user & mendeteksi stok di bawah `min_stok`.
* **`Transactions` + `Detail_Transactions`** — menghitung omzet, modal, & laba harian.
* **`Platform_Settings`** — menulis `wa_gateway_last_ping` (heartbeat) yang dibaca Dashboard Superadmin web untuk menampilkan status gateway.

---

## 🔒 Keamanan

* Service role key hanya hidup di environment server, tidak pernah ke-commit (`.gitignore`).
* Folder sesi `.auth_sessions/` (berisi kredensial perangkat tertaut WhatsApp) juga di-ignore — **jangan pernah membagikannya**.
* Bot hanya merespons **chat pribadi** (grup & channel diabaikan) dan memvalidasi keanggotaan + paket user sebelum membalas data.

---

© 2026 Tim TP-G007 — Capstone Project Tempa led by Dicoding. Bagian dari ekosistem [Ledgerly](https://ledgerly.my.id).
