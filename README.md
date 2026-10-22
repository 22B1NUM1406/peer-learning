# Оюутан хоорондын харилцан суралцах систем

МУИС-ийн оюутнууд хичээлийн хүрээнд бие биедээ асуулт асууж, тайлбартай хариулт өгөх веб систем. Бакалаврын дипломын ажил.

**Стек.** React + Vite, Node.js + Express 5, PostgreSQL, Socket.IO.

**Байршуулалт.** Railway дээр нэг сервис (монолит), өгөгдлийн сан Neon дээр. React-ийн build хийсэн файлуудыг Express өөрөө үйлчилдэг тул frontend, API хоёр нэг домэйнд ажиллана.

## Хавтасны бүтэц

```
peer-learning/
├─ package.json          # build, start (Railway эдгээрийг ажиллуулна)
├─ railway.json          # Railway-ийн тохиргоо, healthcheck
├─ API.md                # Бүх endpoint-ийн жагсаалт
├─ server/
│  ├─ db/schema.sql      # 12 хүснэгт (тайлангийн ER загвар)
│  ├─ db/subjects.txt    # Урьдчилан оруулах хичээлүүд
│  ├─ scripts/           # migrate.js, seed.js
│  ├─ test/              # API-ийн тестүүд (node:test + supertest), 60 тест
│  └─ src/
│     ├─ index.js        # HTTP сервер + Socket.IO
│     ├─ app.js          # Express: middleware, API маршрут, React-ийг үйлчлэх
│     ├─ socket.js       # Socket.IO: cookie-оор нэвтрэлт, message:send
│     ├─ realtime.js     # Socket.IO-г service-ээс ашиглах
│     ├─ db.js           # PostgreSQL холболт, транзакц
│     ├─ middleware/     # loadUser, requireAuth, requireAdmin, sameOrigin, errorHandler
│     ├─ lib/            # алдааны класс, оролт шалгах, нэр нууцлах
│     └─ modules/        # 9 модуль (тайлангийн 2.2-ын модулийн хүснэгт)
│        ├─ auth/        # FR-01, FR-02
│        ├─ users/       # FR-03, FR-04 (профайл, туслах хичээл, туслагчийн эрэмбэ)
│        ├─ subjects/    # FR-17
│        ├─ qa/          # FR-05–FR-10, FR-14, FR-20 (асуулт, хариулт, сэтгэгдэл)
│        ├─ rating/      # FR-11, FR-12, FR-24 (үнэлгээ, "тусалсан", оноо)
│        ├─ search/      # FR-07, FR-13, FR-25 (жагсаалт, хайлт, ижил асуулт)
│        ├─ resources/   # FR-21, FR-23 (холбоос, файл)
│        ├─ moderation/  # FR-15, FR-16, FR-18
│        └─ messages/    # FR-19, FR-22 (мэдэгдэл, мессеж)
└─ client/
   └─ src/
      ├─ lib/            # api.js, auth.jsx, socket.js, hooks.js, format.js
      ├─ components/     # Layout, NotificationBell (P9), QuestionCard, ReportButton, ui
      └─ pages/          # P1–P11 (тайлангийн UI хүснэгтийн дугаараар)
```

### Модулийн загвар (NFR-11)

Модуль бүр 4 файлтай. Шинэ модулийг `auth/` эсвэл `subjects/`-ийг хуулж эхлүүлнэ.

| Файл | Давхарга | Үүрэг | Юу бичихгүй вэ |
|---|---|---|---|
| `*.routes.js` | Routes | URL-ийг controller-т холбож, `requireAuth`, `requireAdmin` залгана | |
| `*.controller.js` | Controller | `req`-ийн оролтыг шалгаж (`lib/validate.js`), service-ийг дуудаж, `res.json` буцаана | SQL |
| `*.service.js` | Service | Бизнесийн дүрэм: эрх, давхардал, оноо | `req`, `res` |
| `*.repo.js` | Data access | Зөвхөн SQL. Үргэлж `$1, $2` параметр ашиглана | Бизнесийн дүрэм |

Алдааг `throw notFound()`, `throw forbidden()` гэж шиднэ. Express 5 үүнийг `errorHandler` руу автоматаар дамжуулна.

## Өөрийн компьютер дээр ажиллуулах

Шаардлагатай: Node.js 20+ ба PostgreSQL. Local-д PostgreSQL суулгахгүй бол Neon-д хоёр дахь (dev) өгөгдлийн сан үүсгэж болно.

```bash
npm run install:all                     # server, client-ийн хамаарлыг суулгана
cp server/.env.example server/.env      # DATABASE_URL, ADMIN_* -ийг бөглөнө
npm run db:migrate                      # хүснэгтүүдийг үүсгэнэ
npm run db:seed                         # админ ба хичээлүүд
```

Хоёр терминал нээж ажиллуулна:

```bash
npm run dev:server     # http://localhost:3000 (API, код өөрчлөгдөхөд дахин ачаална)
npm run dev:client     # http://localhost:5173 (үүнийг хөтчөөр нээнэ)
```

Vite нь `/api` ба `/socket.io` хүсэлтийг 3000 руу дамжуулна. Ингэснээр хөгжүүлэлтийн орчин production-тай адил нэг домэйн мэт ажиллана.

## Тест

Тест өгөгдлийн сангийн бүх өгөгдлийг устгадаг тул **тусдаа** өгөгдлийн сан ашиглана. Нэрэнд нь заавал `test` орсон байна, эс бөгөөс тест ажиллахаас татгалзана.

```bash
cp server/.env.test.example server/.env.test     # DATABASE_URL-ийг тестийн сан руу заана
DATABASE_URL=<тестийн сан> node server/scripts/migrate.js
npm test
```

Одоогийн тест: 60, бүгд амжилттай. Тест бүр тайлангийн аль шаардлагыг шалгаж байгаагаа нэрэндээ бичсэн (UC-01, NFR-01 гэх мэт). Шинэ модуль бүрт `test/<модуль>.test.js` нэмнэ.

## Railway-д байршуулах

Сервер асах бүрд `railway.json`-ийн дагуу эхлээд `db:migrate` (хүснэгт үүсгэнэ, байвал алгасна), `db:seed` (админ, хичээлүүдийг нэмнэ, байвал алгасна) ажиллаад дараа нь сервер асна. Тиймээс өөрийн компьютер дээр команд ажиллуулах шаардлагагүй.

Railway-ийн Variables-д тохируулах хувьсагчид:

| Хувьсагч | Утга |
|---|---|
| `DATABASE_URL` | Neon-ий холболтын мөр (`...?sslmode=require`) |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | Админы имэйл |
| `ADMIN_PASSWORD` | Админы нууц үг (8+ тэмдэгт) |
| `UPLOAD_DIR` | `/data/uploads` (volume-ийг `/data`-д холбоно) |

Шалгах: `https://<домэйн>/api/health` нь `{"ok":true}` буцаана.

## Аюулгүй байдлын шийдлүүд

| Шаардлага | Хэрхэн хэрэгжсэн |
|---|---|
| NFR-01 | Нууц үгийг Argon2id-аар hash хийнэ. OWASP-ийн хамгийн бага тохиргоо: 19 MiB, t=2, p=1 |
| NFR-02 | Cookie-д санамсаргүй 32 байт token хадгалж, өгөгдлийн санд зөвхөн SHA-256 hash-ийг нь хадгална. Cookie нь `HttpOnly`, `Secure` (production), `SameSite=Lax`. Өөр Origin-оос ирсэн POST хүсэлтийг татгалзана |
| NFR-03 | Эрхийг серверт `requireAuth`, `requireAdmin` шалгана. React-ийн шилжүүлэлт зөвхөн тав тухтай байдлын төлөө |
| NFR-04 | Оролтыг controller-т шалгана. SQL нь зөвхөн параметртэй. React текстийг автоматаар escape хийдэг тул `dangerouslySetInnerHTML` ашиглахгүй |
| UC-01 1а-а | Нууц үг буруу, бүртгэлгүй, түдгэлзсэн бүх тохиолдолд ижил ерөнхий мэдэгдэл өгнө. Хариу ирэх хугацаа ч ижил тул имэйл бүртгэлтэй эсэхийг таах боломжгүй |
| FR-18 | Түдгэлзүүлэхэд бүх session устаж, socket холболт тасарна |
| FR-23, NFR-04 | Файлын төрлийг нэрээр биш, эхний байтаар (magic bytes) шалгана; дискэнд санамсаргүй нэрээр хадгална; 10 MB хязгаар |
| FR-21 | Зөвхөн http(s) холбоос зөвшөөрнө (`javascript:` холбоос хориглоно) |
| FR-20 | `author_id` хадгалагдана; нэрийг API-ийн хариунд нууна. Асуугч, админ харна |
| Бусад | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` толгойнууд |

## Хэрэгжсэн шаардлагууд

25 функциональ шаардлага бүгд хэрэгжсэн. Шаардлага бүрийг шалгах тест `server/test/` дотор байна; тестийн нэрэнд FR, NFR дугаарыг бичсэн.

| Хуудас | Зам | FR |
|---|---|---|
| P1 Нэвтрэх / Бүртгэл | `/login` | FR-01, 02 |
| P2 Нүүр | `/` | FR-07, 13 |
| P3 Асуулт асуух | `/questions/new`, `/questions/:id/edit` | FR-05, 06, 20, 25 |
| P4 Асуултын дэлгэрэнгүй | `/questions/:id` | FR-08–12, 14, 15 |
| P5 Хичээлийн хуудас | `/subjects/:id` | FR-04, 07, 21, 23 |
| P6 Материал нэмэх | `/resources/new` | FR-21, 23 |
| P7 Профайл | `/users/:id` | FR-03, 04, 22, 24 |
| P8 Мессеж | `/messages/:userId` | FR-22 |
| P9 Мэдэгдэл | толгой хэсгийн хонх | FR-19 |
| P10 Админ: Мэдээллүүд | `/admin/reports` | FR-16, 18 |
| P11 Админ: Хичээлүүд | `/admin/subjects` | FR-17 |

## Тохируулж болох утгууд

| Хаана | Утга | Анхдагч |
|---|---|---|
| `rating.service.js` → `POINTS` | "Тустай" үнэлгээ, "тусалсан" хариултын оноо | 2, 10 |
| `SIMILARITY_THRESHOLD` орчны хувьсагч | Ижил асуултын төстэй байдлын босго (FR-25) | 0.3 |
| `SESSION_DAYS` орчны хувьсагч | Session хүчинтэй хоног | 7 |
| `resources/files.js` → `MAX_FILE_SIZE` | Файлын дээд хэмжээ | 10 MB |
| `NotificationBell.jsx` → `POLL_MS` | Мэдэгдэл шалгах давтамж | 30 секунд |
