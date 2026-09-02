// server.js
// Telegramdan geolokatsiya qabul qiluvchi va manzillar ro'yxatini
// ko'rsatuvchi oddiy Node.js/Express server.

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_FILE = path.join(__dirname, "data", "addresses.json");

// --- Sozlamalar (environment variables orqali beriladi) ---
// TELEGRAM_BOT_TOKEN     - BotFather bergan token (majburiy emas, faqat
//                          teskari geokodlash uchun emas, balki xabar
//                          yuborish kerak bo'lsa ishlatiladi)
// TELEGRAM_WEBHOOK_SECRET - webhook manzilini taxmin qilib bo'lmasligi
//                           uchun maxfiy so'z. Masalan: "m3n1ngS1rl1S02x"
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "changeme123";

// --- Ma'lumotlarni saqlash (oddiy JSON fayl orqali) ---
function readAddresses() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeAddresses(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
}

if (!fs.existsSync(DATA_FILE)) {
  writeAddresses([]);
}

// --- Teskari geokodlash: lat/lng -> manzil matni ---
// OpenStreetMap Nominatim bepul xizmatidan foydalanamiz.
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uz`;
    const res = await fetch(url, {
      headers: { "User-Agent": "telegram-address-book/1.0" },
    });
    const json = await res.json();
    return json.display_name || `${lat}, ${lng}`;
  } catch (e) {
    return `${lat}, ${lng}`;
  }
}

// --- API: ro'yxatni olish ---
app.get("/api/addresses", (req, res) => {
  const list = readAddresses().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(list);
});

// --- API: qo'lda manzil qo'shish ---
app.post("/api/addresses", (req, res) => {
  const { address, author } = req.body;
  if (!address || !address.trim()) {
    return res.status(400).json({ error: "Manzil bo'sh bo'lishi mumkin emas" });
  }
  const list = readAddresses();
  const entry = {
    id: crypto.randomUUID(),
    address: address.trim(),
    lat: null,
    lng: null,
    source: "manual",
    author: author && author.trim() ? author.trim() : "Noma'lum",
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  writeAddresses(list);
  res.json(entry);
});

// --- API: manzilni o'chirish ---
app.delete("/api/addresses/:id", (req, res) => {
  const list = readAddresses();
  const filtered = list.filter((a) => a.id !== req.params.id);
  writeAddresses(filtered);
  res.json({ ok: true });
});

// --- Telegram webhook ---
// Telegramga shu manzilni bering: https://SIZNING-DOMEN/webhook/<SECRET>
app.post(`/webhook/:secret`, async (req, res) => {
  if (req.params.secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: "Noto'g'ri secret" });
  }

  // Telegramga darhol javob qaytaramiz (talab shunday)
  res.json({ ok: true });

  const update = req.body;
  const message = update.message || update.edited_message;
  if (!message) return;

  const from = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    : "Noma'lum";

  // 1) Geolokatsiya (location) xabari
  if (message.location) {
    const { latitude, longitude } = message.location;
    const addressText = await reverseGeocode(latitude, longitude);
    const list = readAddresses();
    list.push({
      id: crypto.randomUUID(),
      address: addressText,
      lat: latitude,
      lng: longitude,
      source: "telegram",
      author: from,
      createdAt: new Date().toISOString(),
    });
    writeAddresses(list);
    return;
  }

  // 2) Oddiy matn xabari orqali ham manzil qo'shish imkoniyati
  if (message.text && !message.text.startsWith("/")) {
    const list = readAddresses();
    list.push({
      id: crypto.randomUUID(),
      address: message.text.trim(),
      lat: null,
      lng: null,
      source: "telegram-text",
      author: from,
      createdAt: new Date().toISOString(),
    });
    writeAddresses(list);
    return;
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
  console.log(`Webhook manzili: /webhook/${WEBHOOK_SECRET}`);
});
