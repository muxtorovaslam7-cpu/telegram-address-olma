# Manzillar ro'yxati + Telegram geolokatsiya

Bu loyiha:
- Manzillar ro'yxatini saytda ko'rsatadi (40 tadan ortiq bo'lishi mumkin, cheklov yo'q)
- Qo'lda manzil qo'shish imkonini beradi
- Telegram botga yuborilgan **geolokatsiya**larni avtomatik qabul qilib,
  manzilga aylantirib (teskari geokodlash) ro'yxatga qo'shadi
- Oddiy matn xabarlarini ham manzil sifatida qabul qiladi

## 1-qadam: Telegram bot yaratish

1. Telegramda **@BotFather** ni toping va yozing.
2. `/newbot` buyrug'ini yuboring, botga nom va username bering.
3. Sizga token beriladi, masalan:
   `7123456789:AAF-abcDEF1234567890xyz`
   Buni saqlab qo'ying — hech kimga bermang.

## 2-qadam: Serverni joylashtirish (deploy)

Eng oson yo'l — **Render.com** (bepul reja bor):

1. Ushbu papkani (`telegram-address-book`) GitHub'ga yuklang (yangi repo yarating).
2. https://render.com saytida ro'yxatdan o'ting, "New +" → "Web Service" tanlang.
3. GitHub repongizni ulang.
4. Sozlamalar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. "Environment" bo'limida quyidagi o'zgaruvchini qo'shing:
   - `TELEGRAM_WEBHOOK_SECRET` = o'zingiz o'ylab topgan maxfiy so'z
     (masalan: `mySecret2026xyz`)
6. Deploy tugmasini bosing. Bir necha daqiqadan so'ng sizga manzil beriladi,
   masalan: `https://sizning-loyiha.onrender.com`

(Railway.app, Fly.io yoki har qanday Node.js qo'llab-quvvatlaydigan
xosting ham ishlaydi — jarayon deyarli bir xil.)

## 3-qadam: Telegramga webhookni ulash

Terminalda (yoki https://reqbin.com kabi saytda) quyidagi buyruqni bajaring,
`<TOKEN>` va `<SIZNING-DOMEN>` hamda `<SECRET>` ni o'zingiznikiga almashtirib:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<SIZNING-DOMEN>/webhook/<SECRET>"
```

Misol:
```bash
curl "https://api.telegram.org/bot7123456789:AAF-abc.../setWebhook?url=https://sizning-loyiha.onrender.com/webhook/mySecret2026xyz"
```

Muvaffaqiyatli bo'lsa, `{"ok":true,"result":true,...}` javobini olasiz.

## 4-qadam: Sinab ko'rish

1. Botingizga Telegramda kirib, geolokatsiya yuboring
   (📎 → Location → "Send my current location" yoki xaritadan nuqta tanlang).
2. Saytingizni oching (`https://sizning-loyiha.onrender.com`) —
   bir necha soniyadan so'ng yangi manzil ro'yxatda paydo bo'ladi.
3. Saytdagi formadan ham qo'lda manzil qo'shib ko'ring.

## Eslatmalar

- Ma'lumotlar oddiy JSON faylda saqlanadi (`data/addresses.json`).
  Ko'p foydalanuvchi va katta hajm uchun keyinchalik haqiqiy
  ma'lumotlar bazasiga (masalan, PostgreSQL) o'tkazish tavsiya etiladi —
  ayniqsa Render kabi platformalarda fayl tizimi doimiy bo'lmasligi mumkin.
- Hozircha saytga kirish uchun parol/autentifikatsiya yo'q — bu "umumiy
  tizim" bo'lgani uchun havolani kimga bersangiz, o'sha kira oladi.
  Agar himoya kerak bo'lsa (masalan, login/parol), buni qo'shib berishim
  mumkin — shunchaki so'rang.
- Bir nechta odam bir botdan foydalansa, ularning ismi (`author`)
  Telegramdagi ismidan avtomatik olinadi.
