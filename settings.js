// settings.js - Ledgerly Bot Configuration
import "dotenv/config";
import chalk from "chalk";

export const config = {
  // Bot Info
  botName: process.env.BOT_NAME || "Ledgerly-Bot",
  version: "1.0.0",

  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL || "https://omnrknaquyidwgvnrwvi.supabase.co",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  // Session path for Baileys auth
  sessionPath: process.env.SESSION_PATH || ".auth_sessions",

  // Low stock check interval
  checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS) || 600000, // 10 minutes
};

// Validate credentials on startup
const logStatus = (name, val) => val ? chalk.green("✅ Loaded") : chalk.red("❌ Missing");
console.log(chalk.blue("\n[CONFIG] Checking Credentials:"));
console.log(chalk.white(`  • Supabase URL          : ${config.supabase.url ? chalk.green("✅ Configured") : chalk.red("❌ Missing")}`));
console.log(chalk.white(`  • Supabase Service Key  : ${logStatus("ServiceKey", config.supabase.serviceKey)}`));
console.log(chalk.white(`  • Check Interval        : ${config.checkIntervalMs / 1000}s\n`));

if (!config.supabase.serviceKey) {
  console.log(chalk.yellow("⚠️  Peringatan: SUPABASE_SERVICE_ROLE_KEY belum diset di .env!"));
  console.log(chalk.yellow("   Gunakan service role key (bukan anon) agar bot bisa mengakses semua data toko.\n"));
}

export default config;
