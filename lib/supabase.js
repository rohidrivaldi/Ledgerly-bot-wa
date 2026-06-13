// lib/supabase.js - Supabase Integration for Ledgerly WhatsApp Bot
import { createClient } from "@supabase/supabase-js";
import chalk from "chalk";
import { config } from "../settings.js";
import { getTimeStamp } from "./utils.js";

let supabase = null;

// Initialize Supabase client
export const initSupabase = () => {
  if (!config.supabase.url || !config.supabase.serviceKey) {
    console.log(chalk.yellow(`[${getTimeStamp()}] ⚠️ Supabase URL atau Service Key belum dikonfigurasi di .env`));
    return null;
  }

  supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  console.log(chalk.green(`[${getTimeStamp()}] ✅ Client Supabase berhasil diinisialisasi`));
  return supabase;
};

// Get Supabase client
export const getSupabase = () => {
  if (!supabase) {
    initSupabase();
  }
  return supabase;
};

// Update status ping gateway ke Platform_Settings
export const updateGatewayPing = async () => {
  try {
    const client = getSupabase();
    if (!client || !config.supabase.serviceKey) return;

    const { error } = await client
      .from("Platform_Settings")
      .upsert({
        key: "wa_gateway_last_ping",
        value: new Date().toISOString()
      });

    if (error) throw error;
    // Silent success log to avoid terminal clutter
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal memperbarui status ping gateway:`), e.message);
  }
};

// Ambil data user/pemilik toko berdasarkan nomor wa
export const getUserByPhone = async (phoneNum) => {
  try {
    const client = getSupabase();
    if (!client) return null;

    // Supabase menyimpan noTelp sebagai numeric/bigint (contoh: 6285750917686)
    const phoneInt = parseInt(phoneNum);
    if (isNaN(phoneInt)) return null;

    const { data, error } = await client
      .from("Users")
      .select("*")
      .eq("noTelp", phoneInt)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal mengambil profil user berdasarkan nomor:`), e.message);
    return null;
  }
};

// Ambil list produk yang stoknya di bawah batas minimum
export const getLowStockProductsForUser = async (userId) => {
  try {
    const client = getSupabase();
    if (!client) return [];

    // Ambil semua kategori milik user ini
    const { data: categories, error: catErr } = await client
      .from("Kategori")
      .select("kategori_id")
      .eq("user_id", userId);

    if (catErr) throw catErr;
    if (!categories || categories.length === 0) return [];

    const categoryIds = categories.map(c => c.kategori_id);

    // Ambil produk dari kategori-kategori tersebut
    const { data: products, error: prodErr } = await client
      .from("Products")
      .select("*")
      .in("kategori_id", categoryIds);

    if (prodErr) throw prodErr;
    if (!products) return [];

    // Filter produk yang current_stok < min_stok di JS
    return products.filter(p => parseFloat(p.current_stok) < parseFloat(p.min_stok));
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal mengambil produk stok rendah:`), e.message);
    return [];
  }
};

// Ambil semua produk stok rendah untuk semua user premium/enterprise
export const getAllLowStockProducts = async () => {
  try {
    const client = getSupabase();
    if (!client) return [];

    // 1. Ambil semua kategori
    const { data: categories, error: catErr } = await client
      .from("Kategori")
      .select("kategori_id, user_id, nama_kategori");
    if (catErr) throw catErr;
    if (!categories || categories.length === 0) return [];

    // 2. Ambil semua user premium/enterprise yang punya noTelp
    const { data: users, error: userErr } = await client
      .from("Users")
      .select("*")
      .in("paket", ["business", "enterprise"])
      .not("noTelp", "is", null);
    if (userErr) throw userErr;
    if (!users || users.length === 0) return [];

    // 3. Ambil semua produk
    const { data: products, error: prodErr } = await client
      .from("Products")
      .select("*");
    if (prodErr) throw prodErr;
    if (!products || products.length === 0) return [];

    // Buat map penunjang
    const catToUserMap = {};
    categories.forEach(c => {
      catToUserMap[c.kategori_id] = c.user_id;
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.user_id] = u;
    });

    const lowStockList = [];

    // Filter dan petakan
    products.forEach(p => {
      const uId = catToUserMap[p.kategori_id];
      const user = userMap[uId];
      
      if (user && parseFloat(p.current_stok) < parseFloat(p.min_stok)) {
        lowStockList.push({
          product: p,
          user: user
        });
      }
    });

    return lowStockList;
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal memindai seluruh stok rendah:`), e.message);
    return [];
  }
};

// Ambil statistik keuangan hari ini untuk user tertentu
export const getTodayStatsForUser = async (userId) => {
  try {
    const client = getSupabase();
    if (!client) return null;

    // Set waktu mulai hari ini pukul 00.00 WIB (lokal server)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ambil transaksi hari ini
    const { data: txs, error: txErr } = await client
      .from("Transactions")
      .select("transaction_id, isPenjualan, created_at")
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());

    if (txErr) throw txErr;
    if (!txs || txs.length === 0) {
      return { totalSales: 0, totalCapital: 0, count: 0 };
    }

    const txIds = txs.map(t => t.transaction_id);

    // Ambil detail transaksi
    const { data: details, error: detErr } = await client
      .from("Detail_Transactions")
      .select("transaction_id, jumlah, harga_beli_snapshot, harga_jual_snapshot")
      .in("transaction_id", txIds);

    if (detErr) throw detErr;
    if (!details) return { totalSales: 0, totalCapital: 0, count: txs.length };

    let totalSales = 0;
    let totalCapital = 0;

    const txMap = {};
    txs.forEach(t => {
      txMap[t.transaction_id] = t;
    });

    details.forEach(d => {
      const t = txMap[d.transaction_id];
      if (t) {
        const qty = parseFloat(d.jumlah || 0);
        if (t.isPenjualan) {
          totalSales += qty * parseFloat(d.harga_jual_snapshot || 0);
        } else {
          totalCapital += qty * parseFloat(d.harga_beli_snapshot || 0);
        }
      }
    });

    return {
      totalSales,
      totalCapital,
      count: txs.length
    };
  } catch (e) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal mengambil stats keuangan hari ini:`), e.message);
    return null;
  }
};

// Inisialisasi awal
initSupabase();

export default {
  initSupabase,
  getSupabase,
  updateGatewayPing,
  getUserByPhone,
  getLowStockProductsForUser,
  getAllLowStockProducts,
  getTodayStatsForUser
};
