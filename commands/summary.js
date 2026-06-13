// commands/summary.js - Today's Financial Summary Handler
import { getUserByPhone, getTodayStatsForUser } from "../lib/supabase.js";
import { formatRupiah } from "../lib/utils.js";

export const handleSummary = async (sock, chatJid, senderNumber) => {
  try {
    // 1. Cari user di DB
    const user = await getUserByPhone(senderNumber);
    if (!user) {
      return {
        text: `⚠️ *Ledgerly Bot*
        
Nomor WhatsApp Anda (*+${senderNumber}*) belum terdaftar di sistem Ledgerly.
Silakan masuk ke halaman *Pengaturan* di web Ledgerly dan simpan nomor WhatsApp Anda di sana agar bisa menggunakan layanan bot ini.`
      };
    }

    // 2. Cek paket tier
    if (user.paket === "starter") {
      return {
        text: `🔒 *Fitur Premium*
        
Halo *${user.nama}* dari *${user.bisnis}*.
Layanan WhatsApp Bot & Notifikasi otomatis saat ini terkunci karena toko Anda menggunakan paket *Starter (Gratis)*.
Silakan hubungi Admin untuk melakukan upgrade ke paket *Profesional* agar fitur ini terbuka!`
      };
    }

    // 3. Ambil statistik keuangan hari ini
    const stats = await getTodayStatsForUser(user.user_id);
    if (!stats) {
      return { text: "❌ Gagal menarik ringkasan keuangan hari ini. Silakan coba kembali." };
    }

    const { totalSales, totalCapital, count } = stats;
    const grossProfit = totalSales - totalCapital;
    const tgl = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const isLabaMinus = grossProfit < 0;
    const profitLabel = isLabaMinus ? "🔴 Rugi Kotor" : "🟢 Laba Kotor";
    const profitText = formatRupiah(Math.abs(grossProfit));

    return {
      text: `📊 *RINGKASAN HARIAN — ${user.bisnis}*
Tanggal: *${tgl}*

📋 *Data Transaksi Hari Ini:*
• Jumlah Transaksi : *${count}* kali
• Omzet Penjualan  : *${formatRupiah(totalSales)}*
• Modal Terpakai   : *${formatRupiah(totalCapital)}*

💵 *Estimasi Hasil:*
• ${profitLabel} : *${profitText}*

_Catatan: Hasil di atas merupakan hitungan kasar berdasarkan transaksi hari ini. Laba bersih yang dipotong estimasi biaya operasional dapat Anda lihat selengkapnya di Dashboard Keuangan Web Ledgerly._`
    };
  } catch (error) {
    console.error("handleSummary error:", error.message);
    return { text: "❌ Terjadi kesalahan saat menarik ringkasan keuangan Anda. Silakan coba beberapa saat lagi." };
  }
};

export default { handleSummary };
