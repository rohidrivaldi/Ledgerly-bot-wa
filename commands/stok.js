// commands/stok.js - Stok and Menu Command Handler
import { getUserByPhone, getLowStockProductsForUser } from "../lib/supabase.js";
import { config } from "../settings.js";

export const handleStok = async (sock, chatJid, senderNumber) => {
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

    // 3. Tarik produk stok rendah
    const lowStock = await getLowStockProductsForUser(user.user_id);
    if (lowStock.length === 0) {
      return {
        text: `✅ *Stok Aman — ${user.bisnis}*
        
Hebat! Semua stok barang di toko Anda dalam kondisi aman (di atas batas minimum).
Tetap pertahankan performa toko Anda ya! 👍`
      };
    }

    // Format list produk
    const lines = lowStock.map((p, idx) => {
      const skuText = p.SKU ? ` [${p.SKU}]` : "";
      return `${idx + 1}. *${p.nama_product}*${skuText}\n   Stok: *${p.current_stok}* (Batas Min: ${p.min_stok})`;
    }).join("\n\n");

    return {
      text: `⚠️ *LAPORAN STOK KRITIS — ${user.bisnis}*
      
Daftar produk yang berada di bawah batas minimum (reorder point) dan perlu segera direstock:

${lines}

_Segera pesan barang kembali ke supplier agar penjualan tidak terhambat!_`
    };
  } catch (error) {
    console.error("handleStok error:", error.message);
    return { text: "❌ Terjadi kesalahan saat memeriksa stok Anda. Silakan coba beberapa saat lagi." };
  }
};

export const handleMenu = (senderName = "Pemilik Toko") => {
  return {
    text: `🏪 *MENU UTAMA LEDGERLY BOT*
    
Halo *${senderName}*, selamat datang di asisten operasional Ledgerly!

*Perintah tersedia:*
• */stok* - Cek daftar produk yang stoknya kritis (butuh restock)
• */ringkasan* - Cek laporan omzet, pengeluaran modal, dan laba hari ini
• */ping* - Uji respon bot
• */help* - Tampilkan menu bantuan ini

_Gunakan Ledgerly Web untuk pencatatan dan analisis yang lebih lengkap._`
  };
};

export default { handleStok, handleMenu };
