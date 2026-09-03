// server.js
// Telegram bot orqali: 1) lokatsiya yuboriladi, 2) shundan keyin do'kon raqami
// yoziladi -> shu ikkalasi bog'lanib, do'kon xaritada qizil nuqta sifatida
// saqlanadi. Bir xil raqam qayta yuborilsa, eski o'rni yangilanadi.

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "shops.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- Sozlamalar ---
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "changeme123";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

// --- Ma'lumotlarni saqlash: { "12": {number, lat, lng, author, updatedAt} } ---
function readShops() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeShops(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

if (!fs.existsSync(DATA_FILE)) {
  writeShops({});
}

// --- Har bir Telegram chat uchun "lokatsiya kutilmoqda" holati (xotirada) ---
// chatId -> { lat, lng, expiresAt }
const pendingLocations = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

function setPending(chatId, lat, lng) {
  pendingLocations.set(chatId, { lat, lng, expiresAt: Date.now() + PENDING_TTL_MS });
}

function getPending(chatId) {
  const entry = pendingLocations.get(chatId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingLocations.delete(chatId);
    return null;
  }
  return entry;
}

// --- Telegramga xabar yuborish ---
async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return; // token berilmagan bo'lsa, jim o'tkazamiz
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("Telegramga xabar yuborishda xato:", e.message);
  }
}

// --- API: do'konlar ro'yxati ---
app.get("/api/shops", (req, res) => {
  const shops = readShops();
  res.json(Object.values(shops));
});

// --- API: qo'lda do'kon qo'shish/yangilash (xaritadan bosib) ---
app.post("/api/shops", (req, res) => {
  const { number, lat, lng, author } = req.body;
  if (!number || typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "number, lat, lng majburiy" });
  }
  const shops = readShops();
  shops[String(number)] = {
    number: String(number),
    lat,
    lng,
    author: author && author.trim() ? author.trim() : "Noma'lum",
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
  writeShops(shops);
  res.json(shops[String(number)]);
});

// --- API: do'konni o'chirish ---
app.delete("/api/shops/:number", (req, res) => {
  const shops = readShops();
  delete shops[req.params.number];
  writeShops(shops);
  res.json({ ok: true });
});

// --- Telegram webhook ---
app.post(`/webhook/:secret`, async (req, res) => {
  if (req.params.secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: "Noto'g'ri secret" });
  }
  res.json({ ok: true }); // Telegramga darhol javob

  const update = req.body;
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const from = message.from
    ? [message.from.first_name, message.from.last_name].filter(Boolean).join(" ")
    : "Noma'lum";

  // 1) Lokatsiya keldi -> kutish holatiga qo'yamiz
  if (message.location) {
    const { latitude, longitude } = message.location;
    setPending(chatId, latitude, longitude);
    await sendTelegramMessage(
      chatId,
      "📍 Lokatsiya qabul qilindi.\nEndi shu do'konning raqamini yozing (masalan: 12)."
    );
    return;
  }

  // 2) /start yoki boshqa buyruq
  if (message.text && message.text.startsWith("/")) {
    await sendTelegramMessage(
      chatId,
      "Assalomu alaykum!\n1) Avval do'kon joylashuvini (location) yuboring.\n2) Keyin do'kon raqamini yozing.\nShundan so'ng do'kon xaritada qizil nuqta bo'lib chiqadi."
    );
    return;
  }

  // 3) Oddiy matn -> agar kutilayotgan lokatsiya bo'lsa, bu do'kon raqami
  if (message.text) {
    const pending = getPending(chatId);
    if (!pending) {
      await sendTelegramMessage(
        chatId,
        "Avval joylashuvni (📎 → Location) yuboring, keyin do'kon raqamini yozing."
      );
      return;
    }
    const number = message.text.trim();
    if (!number) return;

    const shops = readShops();
    shops[number] = {
      number,
      lat: pending.lat,
      lng: pending.lng,
      author: from,
      source: "telegram",
      updatedAt: new Date().toISOString(),
    };
    writeShops(shops);
    pendingLocations.delete(chatId);

    await sendTelegramMessage(chatId, `✅ Do'kon #${number} xaritada belgilandi.`);
    return;
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
  console.log(`Webhook manzili: /webhook/${WEBHOOK_SECRET}`);
  if (!BOT_TOKEN) {
    console.log("OGOHLANTIRISH: TELEGRAM_BOT_TOKEN berilmagan, bot javob yoza olmaydi.");
  }
});
