# Ifoda Mobile — Texnik Hisobot (Raxbariyat uchun)

**Sana:** 2026-04-20
**Hujjatni tayyorlagan:** Texnik jamoa
**Qamrov:** `ifoda-mobile/` — Vue 3 + Pinia + Capacitor + Axios + WebSocket

Ushbu hujjat MVP bosqichi yakunlanganidan keyin loyihaning joriy holatini,
aniqlangan kamchiliklarni, iOS platformasiga chiqarish uchun zarur qadamlarni
va keyingi bosqichlar uchun tavsiyalarni qamrab oladi.

---

## 1. Qisqacha xulosa

- **MVP tayyor**: Asosiy funksiyalar (autentifikatsiya, chat, mahsulotlar ro'yxati,
  savat, buyurtma, Payme/Click to'lov) ishlamoqda va Android APK sifatida
  sinov qilinmoqda.
- **Xavfsizlik audit natijalarining aksariyati bartaraf etildi** (Android
  backup, HTML sanitizatsiyasi, Sentry'dan PII olib tashlash, env guard'lar va h.k.).
- **Ikkita yirik masala kelishuv bosqichida qoldi**: WebSocket va deep link
  token'lari URL orqali o'tkaziladi (backend tomondan qo'llab-quvvatlash talab).
- **iOS hali qo'llab-quvvatlanmaydi** — platforma qo'shilishi kerak (pastda
  batafsil).
- **Ishonchlilik va tezlik**: chat, login polling, WebSocket qayta ulanishi
  va mahsulotlar ro'yxati barqaror darajaga keltirildi.

---

## 2. Hozirgi texnik stek

| Soha | Texnologiya |
|------|------------|
| Frontend framework | Vue 3 + TypeScript |
| State management | Pinia |
| HTTP | Axios (interceptors, auto-refresh, global toasts) |
| Real-time | WebSocket (custom composable) |
| Mobil qobiq | Capacitor 6 |
| Build tool | Vite + Bun |
| Xarita | Leaflet + OpenStreetMap |
| Ob-havo | Open-Meteo (bepul API) |
| Geokodlash | Nominatim (bepul API) |
| Sentry | Error monitoring (PII filter bilan) |

---

## 3. Bajarilgan asosiy ishlar (Audit natijalariga ko'ra)

### 3.1. Xavfsizlik

- ✅ **Android backup o'chirildi.** Endi `android:allowBackup="false"`,
  `backup_rules.xml` va `data_extraction_rules.xml` bilan ikki qavat himoya.
  Foydalanuvchi ma'lumotlari Google Drive / device-to-device transferga
  tushmaydi.
- ✅ **HTML sanitizatsiyasi DOMPurify'ga o'tkazildi.** Ilgari regex asosida
  edi (XSS xavfi bor edi); endi `src/utils/sanitize.ts` orqali xavfsiz
  konfiguratsiya markazlashtirilgan.
- ✅ **Sentry PII redaksiyasi.** Token, parol, telefon raqam va query
  string'lari endi Sentry hisobotlariga chiqmaydi (`sentryRedact.ts`).
- ✅ **Env guard (fail-fast).** Release build'da agar `VITE_API_URL` yoki
  `VITE_WS_URL` yo'q bo'lsa yoki `http://` / `ws://` bo'lsa — ilova ochilmaydi.
  Bu tasodifan localhost bilan chiqarib yuborilmasligini kafolatlaydi.

### 3.2. Ishonchlilik

- ✅ **WebSocket qayta ulanishi tubdan yaxshilandi.** Exponential backoff +
  jitter, bo'sh token guard, token rotatsiyasini to'g'ri kuzatish, app
  foreground'ga qaytganda qayta ulanish, offline holatida pauza.
- ✅ **Chiqish (logout) markazlashtirildi.** `onAuthLogout` hook orqali
  WebSocket yopiladi, chat holati tozalanadi, savat store reset bo'ladi —
  oldin alohida joylarda qoldiqlar qolardi.
- ✅ **Telegram polling exponential backoff.** Login sahifasida tarmoq
  xatolikda 3 sekund o'rniga 3 → 6 → 12 → 24 sekund polling, offline bo'lsa
  pauza. Backend'ga noo'rin yuk yo'q.
- ✅ **Global toast'lar takrorlanmaydi.** Oldin bitta tarmoq xatoligi uchun
  2–3 ta toast chiqar edi. Endi `isGloballyHandled` yordamida faqat bir
  manba toast ko'rsatadi.

### 3.3. Tezlik

- ✅ **Chat perfomansi.** Uzun tarixli chatlarda O(n) qidiruvlar O(1) bo'ldi
  (id-index Map). Render qilinadigan xabarlar soni 300 ta bilan
  cheklandi (windowing); foydalanuvchi yuqoriga scroll qilganda avto-scroll
  to'xtaydi.
- ✅ **Leaflet lazy-load.** Xarita endi faqat checkout sahifasida
  yuklanadi (`defineAsyncComponent`). Initial bundle taxminan **165 KB
  kichraydi.**
- ✅ **Mahsulot description preview cache.** `WeakMap` orqali
  `htmlToText` natijasi har bir mahsulot uchun bir marta hisoblanadi.

### 3.4. UI/UX

- ✅ **ChatView va ProductsView scroll to'g'rilandi.** Ilgari tepa
  navbar va input yo'qolardi, oxirgi xabar input ostida yashirinardi.
  Endi tepa va input-dock qo'zg'almaydi, faqat xabarlar/mahsulotlar
  ro'yxati scroll bo'ladi.
- ✅ **Ob-havo fallback.** GPS ruxsat berilmagan holatda ham ob-havo
  viloyat markazi koordinatasi asosida ko'rsatiladi.
- ✅ **Buyurtma detail to'ldirildi.** `?order_items=true&product=true`
  so'rovi bilan har bir qator to'liq (nomi, rasmi, paket hajmi, narxi) bilan
  chiqadi.
- ✅ **Account sahifasida jami buyurtmalar soni.**

---

## 4. Hali hal etilmagan (texnik qarz)

### 4.1. P0 — WebSocket va deep link token'lari URL'da

**Holati:** Hal etilmagan. Backend jamoasi bilan kelishuv talab qilinadi.

**Muammo:**
- Foydalanuvchi login uchun Telegram bot'dan `ifoda://auth?token=...` deep
  link orqali keladi.
- WebSocket ulanishi `wss://.../ws/chat/<room>/?token=...` ko'rinishida.
- Query string Android/iOS OS loglarida, ba'zi proxy'larda, crash
  hisobotlarda va ekran suratlarida ko'rinishi mumkin.

**Taklif qilingan yechimlar** (backend qarori talab qiladi):

1. **Bir martalik WS ticket** (tavsiya etilgan):
   - Mobil ilova `POST /api/ws-ticket/` orqali 30 sekund yashovchi ticket
     oladi (Authorization header bilan).
   - WebSocket shu ticket bilan ulanadi, bir marta ishlatiladi.
   - Long-lived access/refresh token URL'ga umuman tushmaydi.

2. **`Sec-WebSocket-Protocol` subprotocol**:
   - Standart header orqali token yuboriladi.
   - Django Channels tomonidan oson qo'llab-quvvatlanadi.

**Hozirgi yumshatish choralari** (allaqachon joriy):
- Sentry'da URL'lardan token avtomatik redakt qilinadi.
- Release build'da faqat `https://` va `wss://` ruxsat etiladi.
- Deep link token bir martalik `login_code` ga o'tkazish fikri muhokamada.

**Taqdirning o'zgarishi uchun kerak:** Backend jamoasidan 1–2 kunlik ish
(ticket endpoint yoki subprotocol qo'llab-quvvatlash).

### 4.2. P2 — Android release ProGuard hali to'liq yoqilmagan

- `minifyEnabled false` holatida. Yoqilsa APK ~30–40% kichrayadi va kod
  obfuskatsiya qilinadi (reverse-engineering qiyinroq bo'ladi).
- **Talab**: native plugin'lar uchun ProGuard qoidalarini sinash (1 kun ish).

### 4.3. P3 — CI/CD hali sozlanmagan

- Hozir release APK qo'l bilan yig'iladi.
- **Tavsiya**: GitHub Actions yoki GitLab CI bilan avtomatik build, sinov,
  Firebase App Distribution'ga yuborish.

---

## 5. iOS platformasiga chiqarish

### 5.1. Umumiy holat

Capacitor loyiha Android va iOS'ni bir xil kod bazasidan qo'llab-quvvatlaydi.
Hozircha **iOS papkasi yo'q** — uni qo'shish kerak.

Qisqa javob: **Kodga katta o'zgartirish kerak emas**; asosiy ish:

1. macOS kompyuterda iOS loyihani yaratish (`bunx cap add ios`).
2. Apple Developer hisobi va sertifikatlar (yillik ~$99).
3. Kerakli ruxsatlar (`Info.plist`) va ikonkalar.
4. TestFlight → App Store Review → ishga tushirish.

### 5.2. Talab qilinadigan resurslar

| Element | Izoh |
|--------|------|
| **Mac kompyuter** | iOS build faqat macOS'da ishlaydi (Xcode kerak). |
| **Apple Developer Account** | Yiliga $99. Individual yoki Organization. |
| **iPhone (jismoniy)** | Sinov uchun. Ba'zi push/geolocation xatti-harakatlari simulyatorda boshqacha. |
| **Vaqt baholash** | Birinchi submission: 2–3 hafta (kod + sinov + review). |

### 5.3. Texnik qadamlar (yuqori daraja)

1. **Loyihaga iOS platformasini qo'shish:**
   ```bash
   bunx cap add ios
   bunx cap sync ios
   ```

2. **`Info.plist` da zarur ruxsatlar matnini yozish** (O'zbek tilida tavsiya etiladi,
   chunki App Store reviewerga ko'rinadi):
   - `NSLocationWhenInUseUsageDescription` — ob-havo va eng yaqin filialni
     aniqlash uchun.
   - `NSCameraUsageDescription` — chat'da rasm yuborish uchun.
   - `NSPhotoLibraryUsageDescription` — galereyadan rasm tanlash uchun.
   - `NSMicrophoneUsageDescription` — agar ovozli xabar kelajakda qo'shilsa.

3. **Deep link (Universal Links) sozlash:**
   - Hozirgi `ifoda://auth?token=...` custom scheme iOS'da ham ishlaydi, lekin
     Apple Universal Links'ni tavsiya qiladi (`https://ifoda.uz/auth/...` ko'rinishida).
   - Bu backend tomondan `apple-app-site-association` faylni domenga joylash
     talab qiladi (1 kunlik ish).

4. **Push notifications** (agar kelajakda kerak bo'lsa):
   - APNs sertifikat (Apple Push Notification service).
   - Firebase Cloud Messaging bilan integratsiya (Android bilan bir xil kod).

5. **App Store sanitariya talablari:**
   - App icon (1024x1024).
   - Launch screen.
   - Screenshot'lar (har bir iPhone size class uchun).
   - Privacy Policy URL (majburiy).
   - App Privacy deklaratsiya (qanday ma'lumot yig'iladi).

### 5.4. iOS'ga xos diqqat qilish kerak bo'lgan jihatlar

- **100vh masalasi.** iOS Safari'da viewport balandligi URL bar bilan
  o'zgaradi. Biz allaqachon `100dvh` ishlatamiz — iOS 15.4+ qo'llab-quvvatlaydi.
  iOS 14 uchun fallback kerak bo'lishi mumkin.
- **WebSocket va orqa fon.** iOS ilova fonga o'tganda WebSocket'ni darhol
  yopadi — qayta ulanish logikasi allaqachon bor, lekin sinov talab.
- **Keyboard avoidance.** Chat input klaviatura chiqqanda to'g'ri joyda
  turmasligi mumkin — `@capacitor/keyboard` plugin va `KeyboardResize` mode
  sozlash kerak bo'ladi.
- **Geolocation aniqlik.** iOS'da `enableHighAccuracy: true` batareya
  ko'proq ishlatadi; balki ikkala platforma uchun ham pastga tushirish
  kerak.
- **In-app browser** (Payme/Click). `@capacitor/browser` iOS'da SFSafariViewController
  ochadi — bu standart va xavfsiz.
- **App Tracking Transparency (ATT).** Agar foydalanuvchi ID'si reklama
  uchun ishlatilmasa, bu dialog talab qilinmaydi.
- **WKWebView performance.** iOS'da WebView Safari'dan farqli, ba'zi CSS
  xususiyatlar ishlamasligi mumkin — kross-platforma sinov zarur.

### 5.5. Taqdir baholash — iOS ni ishga tushirish

| Bosqich | Muddat | Mas'ul |
|---------|--------|--------|
| Apple Developer hisob ochish | 1–2 hafta | Huquqiy/moliya |
| Mac kompyuter olish / ijaraga olish | 1 hafta | Moliya/admin |
| iOS loyihani qo'shish va build sinash | 3–5 kun | Frontend |
| Universal Links sozlash | 2 kun | Backend + Frontend |
| Push notifications (agar kerak) | 3 kun | Frontend + Backend |
| App Store assetlar (icon, screenshot, metadata) | 1 hafta | Dizayner + Marketing |
| TestFlight sinov va App Store Review | 2–3 hafta | QA + Apple |
| **Jami** | **~6–8 hafta** | |

---

## 6. Tavsiyalar (MVP'dan keyin)

### 6.1. Yaqin 1–2 oy (Muhim)

1. **WebSocket ticket yoki subprotocol** — backend bilan birgalikda.
   URL'da token xavfini yo'qotadi.
2. **ProGuard to'liq yoqish** — Android APK hajmi va xavfsizlik uchun.
3. **CI/CD sozlash** — GitHub Actions orqali avtomatik build, test, sign,
   TestFlight/Firebase App Distribution'ga push.
4. **Unit va E2E testlar.** Hozir testlar yo'q. Kamida:
   - Auth flow (Telegram polling, refresh token).
   - Chat xabar yuborish/qabul qilish.
   - Buyurtma yaratish (DELIVERY va PICK_UP).
5. **Telemetry kengaytirish.** Sentry'dan tashqari product analytics
   (masalan, PostHog) — qaysi sahifalar faol, drop-off qayerda.

### 6.2. O'rtacha muddat 3–6 oy (Foyda keltiradigan)

1. **Push notifications.** Buyurtma holati o'zgarganda, yangi AI javobida.
   Android (FCM) + iOS (APNs).
2. **Offline rejim.** Mahsulotlar ro'yxati va savat lokal saqlash —
   internet yo'qligida ham ko'rish.
3. **Ko'p til.** Hozir faqat O'zbek. Rus/Ingliz qo'shish uchun `vue-i18n`
   integratsiyasi (3–5 kun ish).
4. **Chat virtualization (haqiqiy).** Hozirgi windowing 300 xabar bilan
   cheklaydi, lekin 10000+ xabar uchun `vue-virtual-scroller` kerak.
5. **Image CDN va optimizatsiya.** Mahsulot rasmlari hozir to'liq
   yuklanadi — responsive `srcset` yoki CloudFront/Cloudflare image
   resizing kamroq trafik berardi.
6. **Qidiruv tezligi.** Hozir har harf yozilganda serverga borib keladi
   (350ms debounce bilan) — faol kataloglarda local Fuse.js indeks ham
   qo'shish mumkin.

### 6.3. Uzoq muddat 6+ oy (Strategik)

1. **Admin panel mobile.** Hozir faqat foydalanuvchi ilovasi. Agronom/sotuvchi
   uchun alohida role-based UI.
2. **AI rasmini yaxshilash.** Rasm bo'yicha kasallik aniqlash real-time.
3. **Integratsiya: 1C / CRM.** Buyurtmalar avtomatik ichki tizimga.
4. **A/B testing infratuzilmasi.** Qaysi UI varianti ko'proq
   konversiya beradi — ma'lumot asosida qaror.

---

## 7. Xavf baholash matritsasi

| Xavf | Ehtimollik | Ta'sir | Holati |
|------|-----------|--------|--------|
| WS token log'larga tushishi | O'rta | Yuqori | ⚠️ Yumshatilgan, to'liq hal qilish backend'ga bog'liq |
| Production release noto'g'ri env bilan | Past | Yuqori | ✅ Hal etildi (fail-fast) |
| Uzoq chatda freeze | Past | O'rta | ✅ Hal etildi (windowing) |
| iOS chiqishida kechikish | Yuqori | O'rta | ⏳ Reja bor, resurs kutilmoqda |
| App Store rad etishi | O'rta | Yuqori | ⏳ Privacy Policy + ATT tayyor bo'lishi kerak |
| Backend ishdan chiqqanda ilova freezer bo'lishi | Past | Yuqori | ✅ Offline banner, backoff bor |
| Foydalanuvchi ma'lumotlari (token) device backup orqali oqib chiqishi | Past | O'rta | ✅ Hal etildi (Android backup off) |

---

## 8. Xulosa

MVP sifatida Android uchun ilova **ishga tushirishga tayyor**. Asosiy xavfsizlik
kamchiliklari yopildi, tezlik va ishonchlilik yaxshilandi. Ikkita yirik masala
(WS token URL'da va iOS platformasi) — strategik qarorlar talab qiladi va
ularsiz ham ilova MVP maqsadiga javob beradi.

**Tavsiya:**

1. Android MVP'ni ishga tushirish va kichik auditoriyada (100–500 foydalanuvchi)
   sinash.
2. Parallel ravishda: (a) backend bilan WS ticket kelishuvi, (b) iOS
   infratuzilmasini tayyorlash.
3. 2 oy ichida iOS chiqarish; shu vaqt ichida Android dan olingan feedback
   asosida UX yaxshilash.

Qo'shimcha savollar yoki chuqurroq texnik batafsilliklar kerak bo'lsa,
tayyormiz.

---

*Ushbu hujjat loyihaning `ifoda-mobile/AUDIT_REPORT.md` (Ingliz tilidagi batafsil audit)
va joriy kod holatiga asoslangan. Yangilanishlar kod bazasidagi commit'larga
mos ravishda amalga oshirilsin.*
