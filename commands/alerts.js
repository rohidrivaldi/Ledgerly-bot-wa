// commands/alerts.js - Low Stock Background Alert Job
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { getAllLowStockProducts, getSupabase } from "../lib/supabase.js";
import { toJid, getTimeStamp } from "../lib/utils.js";

const ALERTS_FILE = path.resolve("./sent_alerts.json");

// Helper to load sent alerts cache
const loadAlertsCache = () => {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, "utf8");
      return JSON.parse(data || "{}");
    }
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal membaca sent_alerts.json:`), e.message);
  }
  return {};
};

// Helper to save sent alerts cache
const saveAlertsCache = (cache) => {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal menulis sent_alerts.json:`), e.message);
  }
};

// Main alert check process
export const checkAndSendLowStockAlerts = async (sock) => {
  try {
    console.log(chalk.cyan(`[${getTimeStamp()}] 🔍 Memulai pemindaian stok produk rendah...`));
    
    // 1. Tarik semua produk stok rendah untuk user premium
    const lowStockItems = await getAllLowStockProducts();
    const cache = loadAlertsCache();
    
    if (lowStockItems.length === 0) {
      console.log(chalk.green(`[${getTimeStamp()}] ✅ Semua stok produk aman. Tidak ada alert dikirim.`));
      
      // Jika database menunjukkan tidak ada produk stok rendah sama sekali, bersihkan cache lokal
      if (Object.keys(cache).length > 0) {
        saveAlertsCache({});
      }
      return;
    }

    console.log(chalk.cyan(`[${getTimeStamp()}] 📬 Menemukan ${lowStockItems.length} produk di bawah batas minimum.`));

    let alertsSentCount = 0;
    const activeLowStockIds = new Set();

    for (const item of lowStockItems) {
      const p = item.product;
      const u = item.user;
      
      activeLowStockIds.add(p.product_id);
      
      const phoneNum = String(u.noTelp);
      const jid = toJid(phoneNum);
      
      if (!jid) continue;

      const currentStokVal = parseFloat(p.current_stok || 0);
      const minStokVal = parseFloat(p.min_stok || 0);
      
      // Check cache: Kirim jika belum pernah dikirim, ATAU jumlah stok berubah dari pengiriman terakhir
      const cached = cache[p.product_id];
      const shouldNotify = !cached || parseFloat(cached.stok) !== currentStokVal;

      if (shouldNotify) {
        const skuText = p.SKU ? ` (SKU: ${p.SKU})` : "";
        const messageText = `⚠️ *Pemberitahuan Stok Kritis — Ledgerly*
        
Halo *${u.nama}*, stok produk berikut di toko *${u.bisnis}* sudah berada di bawah batas minimum:

📦 *${p.nama_product}*${skuText}
• Stok Saat Ini : *${currentStokVal}*
• Batas Minimum : *${minStokVal}*

_Mohon segera lakukan pembelian atau restock barang ke supplier agar operasional penjualan tetap berjalan lancar!_`;

        console.log(chalk.yellow(`[${getTimeStamp()}] 📤 Mengirim alert stok rendah ke +${phoneNum} untuk: ${p.nama_product}`));
        
        try {
          await sock.sendMessage(jid, { text: messageText });
          
          // Update cache
          cache[p.product_id] = {
            stok: currentStokVal,
            sentAt: new Date().toISOString()
          };
          alertsSentCount++;
          
          // Delay 1.5 detik untuk menghindari rate limit/blokir dari WA
          await new Promise(r => setTimeout(r, 1500));
        } catch (sendErr) {
          console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal mengirim chat WA ke +${phoneNum}:`), sendErr.message);
        }
      }
    }

    // Pembersihan Cache: Hapus produk yang sudah restock (stok >= min) agar jika drop lagi nanti bisa dikirim alert baru
    let cacheCleaned = false;
    Object.keys(cache).forEach(productId => {
      if (!activeLowStockIds.has(productId)) {
        delete cache[productId];
        cacheCleaned = true;
      }
    });

    if (alertsSentCount > 0 || cacheCleaned) {
      saveAlertsCache(cache);
    }
    
    console.log(chalk.green(`[${getTimeStamp()}] Pemindaian stok selesai. Mengirimkan ${alertsSentCount} alert baru.`));
  } catch (err) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Error saat memproses alert stok rendah:`), err.message);
  }
};

// Inisialisasi loop background
let alertIntervalId = null;

export const startLowStockChecker = (sock, intervalMs = 600000) => {
  if (alertIntervalId) {
    clearInterval(alertIntervalId);
  }

  console.log(chalk.cyan(`[${getTimeStamp()}] 🔄 Mengaktifkan background job alert stok rendah (setiap ${intervalMs / 60000} menit)...`));
  
  // Jalankan pengecekan pertama setelah 10 detik agar koneksi WA matang dulu
  setTimeout(() => {
    checkAndSendLowStockAlerts(sock);
  }, 10000);

  alertIntervalId = setInterval(() => {
    checkAndSendLowStockAlerts(sock);
  }, intervalMs);
};

export const stopLowStockChecker = () => {
  if (alertIntervalId) {
    clearInterval(alertIntervalId);
    alertIntervalId = null;
    console.log(chalk.yellow(`[${getTimeStamp()}] ⏹️ Background job alert stok rendah dihentikan.`));
  }
};

export default {
  checkAndSendLowStockAlerts,
  startLowStockChecker,
  stopLowStockChecker
};
