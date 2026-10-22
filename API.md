# API жагсаалт

Бүх API `/api`-аар эхэлнэ. React-ийн build-ийг Express өөрөө үйлчилдэг тул frontend ба API нэг домэйнд ажиллана. Frontend-ээс `fetch('/api/...', { credentials: 'include' })` гэж дуудна.

**Тэмдэглэгээ**

| Тэмдэг | Утга |
|---|---|
| 🔓 | Нэвтрэхгүйгээр дуудаж болно |
| 👤 | Нэвтэрсэн оюутан (`requireAuth`) |
| 🛡 | Админ (`requireAdmin`) |
| ✍ | Зөвхөн контентын эзэн |

**Хариу ба алдаа**

- Амжилттай хариу нь JSON-оор буцна.
- Алдааны хариу: `{ "error": { "code": "VALIDATION", "message": "..." } }`.
- Төлөвийн кодууд:

| Код | Хэзээ |
|---|---|
| 400 | Оролт буруу |
| 401 | Нэвтрээгүй |
| 403 | Эрхгүй, эсвэл түдгэлзүүлсэн хэрэглэгч |
| 404 | Олдсонгүй |
| 409 | Давхардал (жишээ нь имэйл бүртгэлтэй, дахин үнэлсэн) |
| 413 | Файл 10 MB-аас их |

---

## 1. Auth (FR-01, FR-02)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| POST | `/api/auth/register` | 🔓 | `{name, email, password}`. Нууц үгийг Argon2id-аар хэшлээд session үүсгэнэ |
| POST | `/api/auth/login` | 🔓 | `{email, password}`. Түдгэлзүүлсэн хэрэглэгч 403 авна |
| POST | `/api/auth/logout` | 👤 | Session-ийг устгаж, cookie-г цэвэрлэнэ |
| GET | `/api/auth/me` | 👤 | Одоогийн хэрэглэгч `{id, name, role, reputation}` |

Session cookie: `sid`, `HttpOnly`, `Secure`, `SameSite=Lax`, 7 хоног. Railway proxy-ийн ард ажиллах тул `app.set('trust proxy', 1)` тохиргоо заавал хэрэгтэй.

## 2. User / Profile (FR-03, FR-04, FR-24)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| GET | `/api/users/:id` | 👤 | Профайлыг буцаана: нэр, бүрэлдэхүүн сургууль, курс, оноо, туслах хичээлүүд. Имэйлийг буцаахгүй (NFR-12) |
| GET | `/api/users/:id/questions` | 👤 | Тухайн хүний асуултууд. Нэр нууцалсан асуултыг бусдад харуулахгүй |
| GET | `/api/users/:id/answers` | 👤 | Тухайн хүний хариултууд |
| PATCH | `/api/users/me` | 👤 | `{name, faculty, year}` |
| PUT | `/api/users/me/subjects` | 👤 | `{subjectIds: [..]}`: туслах хичээлүүдийг бүхэлд нь солино |

## 3. Subject (FR-04, FR-17)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| GET | `/api/subjects` | 👤 | Идэвхтэй хичээлүүд |
| GET | `/api/subjects/:id` | 👤 | Нэг хичээл |
| GET | `/api/subjects/:id/helpers` | 👤 | Туслах боломжтой оюутнуудыг тухайн хичээлд авсан "тусалсан" хариултын тоогоор эрэмбэлнэ |
| POST | `/api/admin/subjects` | 🛡 | `{name}` |
| PATCH | `/api/admin/subjects/:id` | 🛡 | `{name?, isActive?}` |

## 4. Асуулт, хайлт (FR-05–08, FR-13, FR-20, FR-25)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| GET | `/api/questions` | 👤 | `?subject=&sort=new\|unanswered&q=&page=`. `q` өгвөл бүрэн текст хайлт (FR-13) хийнэ |
| GET | `/api/questions/similar` | 👤 | `?title=`: pg_trgm-ээр хамгийн төстэй 5 асуултыг буцаана (FR-25). Frontend-ээс 300 мс debounce хийж дуудна |
| POST | `/api/questions` | 👤 | `{title, body, subjectId, isAnonymous}` |
| GET | `/api/questions/:id` | 👤 | Асуулт, хариултууд (эхэнд "тусалсан", дараа нь үнэлгээгээр), сэтгэгдлүүд. Хариулт бүрд `votedByMe` талбар |
| PATCH | `/api/questions/:id` | ✍ | `{title?, body?, subjectId?}` |
| DELETE | `/api/questions/:id` | ✍ | Хариулттай асуултад 409 буцаана (FR-06) |

Нэр нууцлах: `is_anonymous = true` үед хариуны `author` талбар `null` болно. Харин асуулгын эзэн өөрөө болон админ нэрийг харна.

## 5. Хариулт, сэтгэгдэл (FR-09, FR-10, FR-14)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| POST | `/api/questions/:id/answers` | 👤 | `{body}`. Асуугчид `new_answer` мэдэгдэл үүсгэнэ |
| PATCH | `/api/answers/:id` | ✍ | `{body}` |
| DELETE | `/api/answers/:id` | ✍ | Тухайн хариулт "тусалсан" байсан бол асуултын тэмдэглэгээ арилж, оноо буцаагдана |
| POST | `/api/questions/:id/comments` | 👤 | `{body}` (500 тэмдэгт хүртэл) |
| POST | `/api/answers/:id/comments` | 👤 | `{body}` |
| DELETE | `/api/comments/:id` | ✍ | Зөвхөн өөрийн сэтгэгдэл |

## 6. Rating ба оноо (FR-11, FR-12, FR-24)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| POST | `/api/answers/:id/vote` | 👤 | "Тустай" үнэлгээ. Өөрийн хариултыг үнэлэхэд 403, дахин үнэлэхэд 409 буцаана |
| DELETE | `/api/answers/:id/vote` | 👤 | Үнэлгээг буцаана |
| PUT | `/api/questions/:id/accepted` | ✍ | `{answerId}` эсвэл `{answerId: null}`. Зөвхөн асуугч. Хариулагчид `accepted` мэдэгдэл үүсгэнэ |

Оноог Rating service нэг транзакц дотор шинэчилнэ. Тогтмол утгууд нь `rating.service.js`-ийн `POINTS`-д байна:

| Үйлдэл | Оноо |
|---|---|
| "Тустай" үнэлгээ авах | +2 (буцаахад −2) |
| Хариулт нь "тусалсан" болох | +10 (болиулах, шилжүүлэхэд −10) |
| Хариулт устгагдах | Тэр хариултаар авсан бүх оноо хасагдана |

Асуугч өөрийн хариултыг "тусалсан" гэж тэмдэглэж болох ч оноо авахгүй. Оноо 0-ээс доош орохгүй.

## 7. Материал (FR-21, FR-23)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| GET | `/api/subjects/:id/resources` | 👤 | Хичээлийн материалууд |
| POST | `/api/resources` | 👤 | `multipart/form-data`: `title, description, subjectId` ба `url` (зөвхөн http/https) эсвэл `file`-ийн аль нэг. Файлыг multer хүлээн авч Railway volume (`/data/uploads`) руу хадгална. Төрлийг файлын эхний байтаар (magic bytes) шалгана |
| GET | `/api/resources/:id/file` | 👤 | Файлыг татна. Дискийн замыг хэрэглэгчид хэзээ ч ил гаргахгүй |
| DELETE | `/api/resources/:id` | ✍ | Файлыг дискнээс мөн устгана |

## 8. Moderation (FR-15, FR-16, FR-18)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| GET | `/api/reports/reasons` | 👤 | Шалтгааны жагсаалт: "Буруу, төөрөгдүүлсэн мэдээлэл", "Зохисгүй агуулга", "Спам, сурталчилгаа", "Шалгалтын материал", "Бусад" |
| POST | `/api/reports` | 👤 | `{targetType, targetId, reason, details?}`. `reason` нь дээрх жагсаалтын нэг. Ижил контентыг дахин мэдээлэхэд 409, өөрийн контентод 400. Мессежийг зөвхөн хүлээн авагч мэдээлнэ |
| GET | `/api/admin/reports` | 🛡 | `?status=open` |
| PATCH | `/api/admin/reports/:id` | 🛡 | `{action: "hide" \| "delete" \| "dismiss"}`. Контентыг нууж, устгаж эсвэл мэдээллийг хааж, `status`-ийг шинэчилнэ |
| GET | `/api/admin/users` | 🛡 | `?status=suspended&q=`: хэрэглэгчийн жагсаалт (P10-ын "Түдгэлзсэн хэрэглэгчид") |
| PATCH | `/api/admin/users/:id/status` | 🛡 | `{status: "suspended" \| "active"}`. Түдгэлзүүлэхэд тухайн хүний бүх session устаж, socket холболт тасарна |

`hide` нь зөвхөн асуулт, хариулт, материалд ажиллана. Сэтгэгдэл, мессежийг устгана. Асуулт эсвэл хариултыг устгахад түүгээр олсон оноо буцаагдана.

## 9. Мессеж ба мэдэгдэл (FR-19, FR-22)

| Арга | Зам | Эрх | Тайлбар |
|---|---|---|---|
| GET | `/api/conversations` | 👤 | Яриануудын жагсаалт: нөгөө хүн, сүүлийн мессеж |
| GET | `/api/conversations/:userId/messages` | 👤 | `?before=<id>`: хуучин мессежийг хуудаслан уншина |
| POST | `/api/conversations/:userId/messages` | 👤 | `{body}`. Socket.IO холбогдоогүй үеийн нөөц зам; хүлээн авагчид мөн `message:new` илгээнэ |
| GET | `/api/notifications` | 👤 | Сүүлийн 20 мэдэгдэл ба уншаагүйн тоо. Frontend 30 секунд тутам дуудна (polling). Асуултыг нээхэд (`GET /api/questions/:id`) түүний мэдэгдэл автоматаар уншсан болно |
| PATCH | `/api/notifications/:id/read` | 👤 | Уншсан болгоно |
| POST | `/api/notifications/read-all` | 👤 | Бүгдийг уншсан болгоно |

**Socket.IO** нь ижил домэйн дээр `io()` гэж хаяггүй холбогдоно. Холбогдох үед сервер `sid` cookie-оор хэрэглэгчийг танина. Хэрэглэгч бүр `user:<id>` өрөөнд (room) орно.

| Үйл явдал | Чиглэл | Өгөгдөл |
|---|---|---|
| `message:send` | клиент → сервер | `{to, body}`. Сервер MESSAGES-д хадгалаад ack буцаана |
| `message:new` | сервер → клиент | `{id, from, body, createdAt}`. Хүлээн авагч болон илгээгчийн бусад цонх руу илгээнэ |

---

## Хавтасны бүтэц

README.md-ийн "Хавтасны бүтэц" хэсгийг үзнэ үү.
