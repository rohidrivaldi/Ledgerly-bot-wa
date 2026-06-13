// index.js - Ledgerly WhatsApp Bot Main Entry Point
import "dotenv/config";
import chalk from "chalk";
import figlet from "figlet";
import qrcode from "qrcode-terminal";
import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import readline from "readline";

// Import local settings, helpers & commands
import { config } from "./settings.js";
import { getTimeStamp, parseCommand, getMessageText, extractNumber } from "./lib/utils.js";
import { initSupabase, updateGatewayPing } from "./lib/supabase.js";
import { handleStok, handleMenu } from "./commands/stok.js";
import { handleSummary } from "./commands/summary.js";
import { startLowStockChecker, stopLowStockChecker } from "./commands/alerts.js";

// Pino logger (fatal only to suppress annoying connection logs in terminal)
const logger = pino({
  level: "fatal"
});

let globalSock = null;
let globalPhoneNumber = null;
let pingIntervalId = null;

// Safe rejection handler to prevent bot crash
process.on("uncaughtException", (error) => {
  console.log(chalk.red(`[${getTimeStamp()}] ❌ Uncaught Exception: ${error.message}`));
});

process.on("unhandledRejection", (reason) => {
  console.log(chalk.yellow(`[${getTimeStamp()}] ⚠️ Unhandled Rejection: ${reason}`));
});

const showBanner = () => {
  const banner = chalk.cyanBright(figlet.textSync("Ledgerly Bot", { font: "Standard" }));
  console.log(banner);
  console.log(chalk.yellow("  Asisten Inventaris & Keuangan UMKM"));
  console.log(chalk.green("  🔐 Login menggunakan Pairing Code\n"));
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Handle incoming messages
const handleMessage = async (sock, messageData) => {
  try {
    const msg = messageData.messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const chatJid = msg.key.remoteJid;
    if (chatJid.endsWith("@newsletter") || chatJid.endsWith("@g.us")) return; // Skip channel dan grup (hanya private chat)

    const senderNumber = extractNumber(chatJid);
    const messageText = getMessageText(msg.message);

    if (!messageText) return;

    // Log message
    console.log(chalk.cyan(`[${getTimeStamp()}] 💬 +${senderNumber}: ${messageText.substring(0, 60)}${messageText.length > 60 ? "..." : ""}`));

    // Parse commands
    const { command, argsText } = parseCommand(messageText);

    let response = null;

    if (command.startsWith("/")) {
      switch (command) {
        case "/menu":
        case "/help":
        case "/start":
          response = handleMenu(msg.pushName || "Pemilik Toko");
          break;

        case "/stok":
          response = await handleStok(sock, chatJid, senderNumber);
          break;

        case "/ringkasan":
        case "/keuangan":
          response = await handleSummary(sock, chatJid, senderNumber);
          break;

        case "/ping":
          response = { text: "🏓 Pong! Bot Ledgerly aktif dan siap membantu." };
          break;

        default:
          response = { text: "❓ Perintah tidak dikenal. Kirim */menu* untuk melihat daftar perintah yang tersedia." };
          break;
      }

      if (response) {
        await sock.sendMessage(chatJid, response, { quoted: msg });
      }
    }
  } catch (error) {
    console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal memproses pesan:`), error.message);
  }
};

// Start WhatsApp connection
const startBot = async () => {
  showBanner();

  const sessionPath = config.sessionPath;
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  console.log(chalk.blue(`[${getTimeStamp()}] 📱 Versi Baileys: ${version.join(".")}`));

  const isLoggedIn = state.creds?.registered;
  let phoneNumber = process.argv[2] || globalPhoneNumber;

  if (!isLoggedIn && !phoneNumber) {
    console.log(chalk.yellow("\n  Format nomor WhatsApp yang direkomendasikan:"));
    console.log(chalk.gray("  • 628xxxxxxxxxx (Tanpa '+' atau spasi)"));
    console.log(chalk.gray("  • 08xxxxxxxxxx\n"));

    phoneNumber = await question(chalk.cyan("  Masukkan nomor WhatsApp Bot Anda: "));
  }

  if (!isLoggedIn && !phoneNumber) {
    console.log(chalk.red(`[${getTimeStamp()}] ❌ Nomor WhatsApp diperlukan untuk pairing!`));
    process.exit(1);
  }

  if (phoneNumber) {
    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (phoneNumber.startsWith("0")) {
      phoneNumber = "62" + phoneNumber.slice(1);
    }
    globalPhoneNumber = phoneNumber;

    if (!isLoggedIn) {
      console.log(chalk.green(`\n[${getTimeStamp()}] 📲 Melakukan pairing untuk nomor: +${phoneNumber}\n`));
    }
  } else if (isLoggedIn) {
    console.log(chalk.green(`[${getTimeStamp()}] ✅ Sesi tersimpan ditemukan, menyambungkan otomatis...`));
  }

  // Create WASocket
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
  });

  globalSock = sock;

  // Request pairing code if not logged in
  if (!isLoggedIn) {
    console.log(chalk.yellow(`[${getTimeStamp()}] ⏳ Meminta pairing code dari WhatsApp...`));
    try {
      await new Promise(r => setTimeout(r, 3000));
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(chalk.green(`\n[${getTimeStamp()}] 🔐 PAIRING CODE: ${code}\n`));
      console.log(chalk.yellow("   Cara menghubungkan:"));
      console.log(chalk.yellow("   1. Buka aplikasi WhatsApp di HP Anda"));
      console.log(chalk.yellow("   2. Pilih Perangkat Tertaut (Linked Devices) > Tautkan Perangkat (Link a Device)"));
      console.log(chalk.yellow("   3. Pilih 'Tautkan dengan nomor telepon saja' (Link with phone number instead)"));
      console.log(chalk.yellow("   4. Masukkan kode di atas.\n"));
    } catch (err) {
      console.error(chalk.red(`[${getTimeStamp()}] ❌ Gagal mendapatkan pairing code:`), err.message);
    }
  }

  // Listen to connection changes
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(chalk.yellow(`[${getTimeStamp()}] 📱 Scan QR Code ini jika Pairing Code gagal:\n`));
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      console.log(chalk.red(`[${getTimeStamp()}] ❌ Koneksi terputus. Kode alasan: ${reason}`));

      if (pingIntervalId) {
        clearInterval(pingIntervalId);
        pingIntervalId = null;
      }
      stopLowStockChecker();

      if (shouldReconnect) {
        console.log(chalk.yellow(`[${getTimeStamp()}] 🔄 Mencoba menyambungkan kembali dalam 3 detik...`));
        setTimeout(startBot, 3000);
      } else {
        console.log(chalk.red(`[${getTimeStamp()}] 🚪 Anda telah keluar (logged out). Hapus folder ${sessionPath} lalu jalankan ulang bot.`));
        process.exit(1);
      }
    }

    if (connection === "open") {
      console.log(chalk.green(`[${getTimeStamp()}] ✅ Bot WhatsApp berhasil terhubung!`));

      const user = sock.user;
      if (user) {
        console.log(chalk.green(`[${getTimeStamp()}] 👤 Masuk sebagai: +${user.id.split(":")[0]}`));
      }

      // Mulai background check alert stok rendah
      startLowStockChecker(sock, config.checkIntervalMs);

      // Mulai update status ping gateway ke database (setiap 30 detik)
      // Supaya Dashboard Superadmin tahu kalau bot sedang aktif berjalan
      updateGatewayPing();
      pingIntervalId = setInterval(() => {
        updateGatewayPing();
      }, 30000);

      console.log(chalk.cyan(`[${getTimeStamp()}] 🤖 Bot Ledgerly siap digunakan.`));
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", (data) => handleMessage(sock, data));
};

// Mulai inisialisasi database Supabase
initSupabase();

// Jalankan Bot
startBot();
