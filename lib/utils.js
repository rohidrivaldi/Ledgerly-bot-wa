// lib/utils.js - Utility Functions for Ledgerly WhatsApp Bot

// Normalize phone number to 628xxx format
export const normalizePhone = (input) => {
  if (!input) return null;

  // Remove all non-numeric characters
  let phone = input.replace(/[^0-9]/g, "");

  // Convert 08xxx to 628xxx
  if (phone.startsWith("0")) {
    phone = "62" + phone.slice(1);
  }

  // Ensure starts with 62
  if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }

  return phone;
};

// Format number to WhatsApp JID
export const toJid = (phone) => {
  const normalized = normalizePhone(phone);
  return normalized ? `${normalized}@s.whatsapp.net` : null;
};

// Extract number from JID
export const extractNumber = (jid) => {
  if (!jid) return null;

  // Remove @s.whatsapp.net, @g.us, @lid suffix
  let number = jid.replace(/@.*$/, "");

  // Handle device ID formats (e.g. 62xxx:123@lid)
  if (number.includes(":")) {
    number = number.split(":")[0];
  }

  return number;
};

// Format Rupiah currency
export const formatRupiah = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Get timestamp for logging (Asia/Jakarta timezone)
export const getTimeStamp = () => {
  return new Date().toLocaleTimeString("id-ID", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
};

// Parse command from message text
export const parseCommand = (text) => {
  if (!text || !text.startsWith("/")) {
    return { command: text || "", argsText: "" };
  }

  const parts = text.trim().split(" ");
  const command = parts[0].toLowerCase();
  const argsText = parts.slice(1).join(" ");

  return { command, argsText };
};

// Get message text from various message types
export const getMessageText = (message) => {
  if (!message) return "";

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ""
  );
};

export default {
  normalizePhone,
  toJid,
  extractNumber,
  formatRupiah,
  getTimeStamp,
  parseCommand,
  getMessageText,
};
