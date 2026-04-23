# Guide — tsoy-glasses

Подробная документация для разработчиков, которые впервые открывают этот проект.
Здесь объясняется **как всё устроено**, почему принято то или иное решение, и что нужно сделать чтобы всё заработало.

---

## Содержание

1. [Что это вообще такое](#1-что-это-вообще-такое)
2. [Структура репозитория](#2-структура-репозитория)
3. [Как запустить локально](#3-как-запустить-локально)
4. [Переменные окружения](#4-переменные-окружения)
5. [Клиент — AR-примерка (8th Wall)](#5-клиент--ar-примерка-8th-wall)
6. [Админка — каталог и редактор](#6-админка--каталог-и-редактор)
7. [Связь Редактор ↔ Client через postMessage](#7-связь-редактор--client-через-postmessage)
8. [API бэкенда (NestJS)](#8-api-бэкенда-nestjs)
9. [Формат трансформов — важно не перепутать](#9-формат-трансформов--важно-не-перепутать)
10. [Сборка и деплой](#10-сборка-и-деплой)
11. [Docker Compose — продакшн-деплой](#11-docker-compose--продакшн-деплой)
12. [Частые проблемы и их решения](#12-частые-проблемы-и-их-решения)

---

## 1. Что это вообще такое

Это система AR-примерки очков. Пользователь открывает ссылку в браузере телефона, камера включается, 8th Wall находит лицо — и на него накладывается 3D-модель очков.

Система состоит из **трёх частей**:

| Часть                | Кто использует                 | Задача                                         |
| -------------------- | ------------------------------ | ---------------------------------------------- |
| **client**           | Конечный пользователь          | Рендерит AR сцену с очками на лице             |
| **admin**            | Разработчик / контент-менеджер | Управляет каталогом, редактирует трансформы    |
| **backend (NestJS)** | Оба приложения                 | Хранит GLB-файлы (S3) и метаданные (PostgreSQL) |

Клиент и админка — два **независимых** приложения. Они связываются через backend (для данных) и через `postMessage` (для realtime-превью в редакторе).

---

## 2. Структура репозитория

```
tsoy-glasses/
├── admin/                  # React-приложение (Vite + React Router v7)
│   ├── src/
│   │   ├── App.jsx                  # Редактор трансформов
│   │   ├── main.jsx                 # Маршрутизатор
│   │   ├── components/
│   │   │   ├── ARPreview.jsx        # iframe с клиентом
│   │   │   ├── ModelPreview.jsx     # Миниатюра модели в каталоге
│   │   │   ├── ProtectedRoute.jsx   # Защита маршрутов через JWT
│   │   │   ├── TransformControls.jsx # Слайдеры позиция/поворот/масштаб
│   │   │   └── SliderRow.jsx        # Один ряд слайдера
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx      # JWT хранится в cookie, Bearer в axios
│   │   ├── pages/
│   │   │   ├── Catalog.jsx          # Список всех моделей
│   │   │   └── Login.jsx            # Страница входа
│   │   └── utils/
│   │       ├── math.js              # Эйлер ↔ кватернион, логарифм масштаба
│   │       └── config.js            # Конвертация объекта конфига в UI-трансформ
│   └── .env                         # (создать вручную из .env.example)
│
├── client/                 # 8th Wall AR (webpack + vanilla JS)
│   ├── src/
│   │   ├── index.html               # Точка входа. ВСЯ логика сцены — здесь
│   │   └── .expanse.json            # Граф сцены 8th Wall
│   ├── config/
│   │   └── webpack.config.js        # Сборка: вставляет API_URL в index.html
│   ├── external/                    # 8th Wall runtime (НЕ в git, положить вручную)
│   └── .env                         # (создать вручную из .env.example)
│
├── backend/                # NestJS API
│   ├── src/
│   │   ├── app.controller.ts        # Маршруты /apiback/glasses
│   │   ├── app.service.ts           # Бизнес-логика
│   │   ├── entities/
│   │   │   └── glasses.entity.ts    # TypeORM сущность (id, name, key, position, rotation, scale)
│   │   ├── dto/create-glasses.dto.ts
│   │   ├── common/S3/               # AWS S3 сервис (загрузка, получение, удаление файлов)
│   │   ├── modules/auth/            # JWT аутентификация (login, register)
│   │   └── strategies/jwt.strategy.ts
│   └── .env                         # (создать вручную)
│
├── nginx/                  # Reverse proxy
│   ├── nginx.conf           # Конфигурация: / → client, /admin/ → admin, /apiback/ → backend
│   └── Dockerfile
│
├── docker-compose.yml      # admin + client + backend + postgres + nginx + certbot
└── package.json            # npm workspaces
```

### Про папку `external/`

`client/external/` содержит проприетарный 8th Wall runtime и **закоммичена в репозиторий**. Это нормально для приватного репо. Если репозиторий станет публичным — эти файлы нужно убрать из git: 8th Wall (Niantic) запрещает публичное распространение runtime в ToS.

---

## 3. Как запустить локально

### Шаг 1 — Установить зависимости (frontend)

```bash
# Из корня репозитория
npm install
```

### Шаг 2 — Установить зависимости (backend) и создать .env

```bash
cd backend && npm install
```

Создать `backend/.env` (см. раздел [Переменные окружения](#4-переменные-окружения)).
Локально нужен запущенный PostgreSQL.

### Шаг 3 — Создать .env файлы для frontend

```bash
cp admin/.env.example admin/.env
cp client/.env.example client/.env
```

Заполнить значениями (см. раздел [Переменные окружения](#4-переменные-окружения)).

### Шаг 4 — Запустить

```bash
# Терминал 1: бэкенд
cd backend && npm run start:dev

# Терминал 2: клиент
npm run client

# Терминал 3: админка
npm run admin
```

### Как открыть

| Приложение | URL |
| ---------- | --------------------------------------- |
| Клиент     | `http://localhost:8080/?modelId=<UUID>` |
| Админка    | `http://localhost:5173/`                |
| API        | `http://localhost:3000/apiback/...`     |

> Первый вход в админку — на странице `/` нужно войти (логин/пароль). Создать первого пользователя через `POST /apiback/auth/register`.

---

## 4. Переменные окружения

### Админка (`admin/.env`)

```
VITE_BASE_URL=http://localhost:3000/apiback
VITE_CLIENT_URL=http://localhost:8080
VITE_COOKIE_NAME=admin_token
VITE_COOKIE_MAX_AGE=604800
```

| Переменная | Описание |
|---|---|
| `VITE_BASE_URL` | Базовый URL бэкенда **включая `/apiback`**. В продакшне: `https://domain.ru/apiback` |
| `VITE_CLIENT_URL` | URL клиента, который открывается в iframe в редакторе |
| `VITE_COOKIE_NAME` | Имя cookie для хранения JWT-токена |
| `VITE_COOKIE_MAX_AGE` | Время жизни cookie в секундах (по умолчанию 7 дней = 604800) |

> `VITE_BASE_URL` используется в коде как `${VITE_BASE_URL}/glasses`, `${VITE_BASE_URL}/auth/login` и т.д.

### Клиент (`client/.env`)

```
API_URL=http://localhost:3000/apiback/glasses
```

Встраивается в HTML при сборке через `HtmlWebpackPlugin`:

```html
<script>
const BACKEND_URL = '<%= API_URL %>'
```

### Бэкенд (`backend/.env`)

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=tsoy_glasses

S3_BUCKET=your-bucket
S3_REGION=ru-central1
S3_ENDPOINT=https://storage.yandexcloud.net
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key

JWT_SECRET=change-this-to-a-long-random-string
```

| Переменная | Описание |
|---|---|
| `DB_HOST` / `POSTGRES_HOST` | Хост PostgreSQL |
| `DB_PORT` / `POSTGRES_PORT` | Порт (по умолчанию 5432) |
| `DB_USERNAME` | Пользователь БД |
| `DB_PASSWORD` | Пароль БД |
| `DB_NAME` | Имя базы данных |
| `S3_BUCKET` | Имя S3-бакета для хранения GLB-файлов |
| `S3_REGION` | Регион S3 |
| `S3_ENDPOINT` | Endpoint S3-совместимого хранилища |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Ключи доступа к S3 |
| `JWT_SECRET` | Секрет для подписи JWT. **Обязательно изменить в продакшне.** |

---

## 5. Клиент — AR-примерка (8th Wall)

### Технологии

- **Vanilla JS** (весь код — один `<script>` в `index.html`)
- **8th Wall XR** — face tracking через камеру
- **Three.js** — рендеринг 3D
- **webpack** — сборка

### Что делает клиент при загрузке

```
1. Читает ?modelId= из URL
2. Показывает лоадер (progress bar)
3. Запрашивает GET /apiback/glasses/<modelId>
4. Получает dto (трансформ) и file.base64 (GLB)
5. Применяет трансформ к pendingTransform
6. Декодирует base64 → ArrayBuffer → Blob URL
7. Загружает GLB через THREE.GLTFLoader
8. Ждёт, пока 8th Wall найдёт face mesh объект
9. Прикрепляет модель к faceMeshObj.parent (face anchor)
10. Прячет лоадер
```

### Как работает face tracking

8th Wall создаёт граф объектов из `.expanse.json`. Клиент ищет face mesh перебором:

```js
// Берёт первый меш с > 400 вершинами — это геометрия лица
xrScene.scene.traverse((obj) => {
  if (obj.isMesh && obj.geometry?.attributes?.position?.count > 400) {
    faceMeshObj = obj;
  }
});
```

Модель прикрепляется к `faceMeshObj.parent` — это face anchor, который двигается вместе с лицом.

### Pending transform

Трансформ с сервера может прийти раньше, чем GLTFLoader завершит загрузку модели. Поэтому используется `pendingTransform`:

```js
function applyTransform(d) {
  if (!loadedModel) {
    pendingTransform = d; // Сохраняем, применим когда модель загрузится
    return;
  }
  loadedModel.position.set(...d.position);
  loadedModel.quaternion.set(...d.rotation);
  loadedModel.scale.set(...d.scale);
}
```

### Слушатель postMessage

```js
window.addEventListener("message", (e) => {
  const d = e.data;
  if (d.type === "adminSetTransform") applyTransform(d);
  if (d.type === "adminLoadModel") loadModelFromBase64(d.base64);
});
```

---

## 6. Админка — каталог и редактор

### Технологии

- **React 18** + **Vite**
- **React Router v7** (SPA с `basename: /admin`)
- **Axios** для HTTP (JWT-токен подставляется через `axios.defaults.headers`)
- CSS Modules

### Маршрутизация

```
/admin/auth/login  →  Login.jsx      (публичный)
/admin/            →  Catalog.jsx    (защищён ProtectedRoute)
/admin/editor      →  App.jsx        (защищён ProtectedRoute)
```

`ProtectedRoute` читает токен из `AuthContext`. Если токена нет — редирект на `/admin/auth/login`.

### Аутентификация

`AuthContext.jsx` управляет JWT-токеном:

- При входе: `POST /apiback/auth/login` → получает `accessToken` → сохраняет в cookie
- Токен добавляется как `Authorization: Bearer <token>` во все axios-запросы
- При `logout()` — cookie удаляется, заголовок сбрасывается
- `VITE_COOKIE_NAME` и `VITE_COOKIE_MAX_AGE` управляют именем и сроком жизни cookie

### Каталог (`Catalog.jsx`)

Открывается на `/admin/`. Показывает сетку всех моделей из `GET /apiback/glasses`.

Возможности:
- Просмотр списка всех моделей с миниатюрами (`ModelPreview`)
- Загрузка новой модели (drag & drop `.glb` + ввод названия) → `POST /apiback/glasses`
- Удаление модели → `DELETE /apiback/glasses/:id`
- Открытие модели в редакторе → переход на `/admin/editor?modelId=<UUID>`
- Лог операций с прогрессом загрузки

### Редактор (`App.jsx`)

Открывается на `/admin/editor?modelId=<UUID>`. Работает с одной конкретной моделью.

```
1. Читает modelId из URL
2. Запрашивает GET /apiback/glasses/<modelId>
3. Заполняет слайдеры (position/rotation/scale) текущими значениями
4. Передаёт base64 в ARPreview → iframe клиента
5. При движении слайдеров → postMessage в iframe (realtime)
6. «Сохранить положение» → PATCH /apiback/glasses/<modelId>
7. «Сбросить» → откат к значениям, загруженным при открытии
8. «Назад в каталог» → navigate("/")
```

### ARPreview и iframe

`ARPreview.jsx` встраивает клиент в `<iframe>`:

```jsx
<iframe
  src={AR_URL}  // из VITE_CLIENT_URL
  allow="camera; microphone; accelerometer; gyroscope; xr-spatial-tracking"
/>
```

Проблема гонки (iframe ещё не загрузился при первом `postMessage`) решена через `pendingRef`:

```js
function handleLoad() {
  if (modelBase64) sendModel(iframe, modelBase64);
  const p = pendingRef.current;
  if (p) sendTransform(iframe, p.modelName, p.transform);
}
```

### Кнопка «Сохранить положение»

Отправляет `PATCH /apiback/glasses/<uuid>`. Rotation отправляется как кватернион (конвертация из UI-Эйлера в `applyTransformToConfig`).

**Важно:** PATCH сохраняет только `position`, `rotation`, `scale`. Поле `name` не изменяется из редактора — только из каталога при загрузке.

---

## 7. Связь Редактор ↔ Client через postMessage

### Схема

```
Пользователь двигает слайдер
        ↓
App.jsx: handleTransformChange()
        ↓
ARPreview.jsx: useEffect([transform]) → sendTransform()
        ↓
iframe.contentWindow.postMessage({ type: 'adminSetTransform', ... })
        ↓
client/index.html: window.addEventListener('message', ...)
        ↓
applyTransform(d) → обновляет модель в THREE.js сцене
```

### Типы сообщений

#### `adminSetTransform`

```js
{
  type: 'adminSetTransform',
  modelName: 'Название модели',
  position: [0.0, -0.05, 0.0],     // [x, y, z] в метрах
  rotation: [0.0, 0.0, 0.0, 1.0],  // кватернион [x, y, z, w]
  scale:    [0.5, 0.5, 0.5],
  hidden:   false,
}
```

> **Rotation здесь — кватернион!** В UI слайдеры показывают углы в градусах, но перед отправкой `eulerDegToQuat()` конвертирует их.

#### `adminLoadModel`

```js
{
  type: 'adminLoadModel',
  base64: '<строка base64 GLB файла>',
}
```

---

## 8. API бэкенда (NestJS)

Глобальный префикс: `/apiback`. Все маршруты начинаются с него.

### `GET /apiback/glasses`

Возвращает список всех моделей (без файлов).

**Response:**
```json
[
  {
    "id": "<UUID>",
    "name": "Название",
    "position": [0, 0, 0],
    "rotation": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  }
]
```

### `GET /apiback/glasses/:uuid`

Возвращает трансформ и GLB файл по UUID.

**Response:**
```json
{
  "dto": {
    "name": "Название",
    "position": [0, 0, 0],
    "rotation": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  },
  "file": {
    "base64": "<строка base64>",
    "contentType": "model/gltf-binary"
  }
}
```

**Нюансы:**
- `position`, `rotation`, `scale` могут быть строкой (`"[0, 0, 0]"`) или массивом. Оба клиента обрабатывают оба варианта через `const parseArr = (v) => (Array.isArray(v) ? v : JSON.parse(v))`.
- `rotation` — **кватернион** `[x, y, z, w]`. Не Эйлер.
- `file.base64` может весить несколько мегабайт.

### `GET /apiback/glasses/:uuid/model`

Возвращает GLB файл как поток байт (StreamableFile). Не требует декодирования base64. Используется для прямого скачивания файла.

### `POST /apiback/glasses`

Загружает новую модель.

**Request:** `multipart/form-data`
- `model` — файл `.glb`
- `name` — название модели (обязательно)

**Response:** объект созданной модели с UUID.

### `PATCH /apiback/glasses/:uuid`

Обновляет параметры модели.

**Request body:**
```json
{
  "position": [0.0, -0.05, 0.0],
  "rotation": [0.0, 0.0, 0.0, 1.0],
  "scale": [0.5, 0.5, 0.5]
}
```

> Поле `name` в PATCH тоже принимается, но редактор его не отправляет.

### `DELETE /apiback/glasses/:uuid`

Удаляет модель: сначала файл из S3, затем запись из БД.

**Response:** `{ "id": "<UUID>" }`

### `POST /apiback/auth/register`

Создаёт нового администратора.

**Request body:** `{ "login": "admin", "password": "secret" }`

### `POST /apiback/auth/login`

Аутентификация. Пароль сверяется с bcrypt-хешем.

**Request body:** `{ "login": "admin", "password": "secret" }`

**Response:** `{ "id": "<UUID>", "accessToken": "<JWT>" }`

JWT истекает через 8 часов.

### Хранение файлов

Файлы хранятся в S3-совместимом хранилище:
- При `POST /apiback/glasses` → загружает в S3 с ключом `glasses/<uuid>`
- При `GET /apiback/glasses/:id` → читает из S3, кодирует в base64
- При `DELETE /apiback/glasses/:id` → удаляет из S3

### CORS

Бэкенд создаётся с `{ cors: true }` — разрешены запросы со всех origin'ов. Для продакшна рекомендуется ограничить.

---

## 9. Формат трансформов — важно не перепутать

### Где что хранится

| Место                                   | Формат rotation                           |
| --------------------------------------- | ----------------------------------------- |
| PostgreSQL (backend)                    | Кватернион `[x, y, z, w]` (jsonb)         |
| API ответ `dto.rotation`                | Кватернион `[x, y, z, w]`                 |
| Слайдеры в UI (админка)                 | Углы Эйлера в **градусах** `[rx, ry, rz]` |
| `postMessage adminSetTransform`         | Кватернион `[x, y, z, w]`                 |
| Three.js `quaternion.set(x, y, z, w)`   | Кватернион `[x, y, z, w]`                 |

### Где происходит конвертация

```
API (кватернион) → modelToTransform() → UI state (Эйлер в градусах)
                                              ↓
                              пользователь двигает слайдер
                                              ↓
UI state (Эйлер) → eulerDegToQuat() → postMessage / PATCH (кватернион)
```

Функции в `admin/src/utils/math.js`:

- **`quatToEulerDeg(qx, qy, qz, qw)`** — кватернион → градусы Эйлера (XYZ порядок)
- **`eulerDegToQuat(rx, ry, rz)`** — градусы Эйлера → кватернион

### Логарифмический масштаб слайдера

Слайдер масштаба работает логарифмически. Диапазон `0..1000` маппится на `0.0001..25`.

```js
export function scaleToSlider(v)  // реальное значение → позиция слайдера 0..1000
export function sliderToScale(s)  // позиция слайдера 0..1000 → реальное значение
```

---

## 10. Сборка и деплой

### Команды

```bash
npm run build:admin    # Собирает admin в admin/dist/
npm run build:client   # Собирает client в client/dist/ (требует external/)
npm run build:all      # Оба сразу
cd backend && npm run build   # Собирает backend в backend/dist/
```

### Клиент после сборки

```
client/dist/
├── index.html      ← API_URL уже вшит как строка
├── bundle.js
├── external/       ← скопирован из client/external/
└── expanse.json
```

### Adminка после сборки

`admin/dist/` — стандартная Vite-сборка:

```
dist/
├── index.html
└── assets/
    ├── index-xxx.js
    └── index-xxx.css
```

### Обязательно HTTPS в продакшне

**Клиент (AR) работает только по HTTPS.** Camera API недоступен без secure context. `localhost` — исключение (работает по HTTP).

### Проверка `external/` перед сборкой

Перед `npm run build:client` автоматически запускается `scripts/check-external.js`. Если 8th Wall runtime файлов нет — сборка упадёт с понятным сообщением.

---

## 11. Docker Compose — продакшн-деплой

### Сервисы

| Сервис | Роль |
|---|---|
| `admin` | Nginx-сервер со статикой Vite-сборки |
| `client` | Nginx-сервер со статикой webpack-сборки |
| `backend` | NestJS API сервер |
| `postgres` | PostgreSQL 16 |
| `nginx` | Reverse proxy + HTTPS терминация |
| `certbot` | Авторегенерация TLS-сертификатов Let's Encrypt |

### Nginx маршрутизация

| Путь | Проксирует на |
|---|---|
| `/` | `client:80` |
| `/admin/` | `admin:80` |
| `/apiback/` | `backend:3000` |

### Переменные для Docker Compose

Создать файл `.env` в корне (рядом с `docker-compose.yml`):

```bash
# Домен
NGINX_CERT_DOMAIN=your-domain.ru

# Admin build args
ADMIN_VITE_BASE_URL=https://your-domain.ru/apiback
ADMIN_VITE_CLIENT_URL=https://your-domain.ru
ADMIN_VITE_COOKIE_NAME=admin_token
ADMIN_VITE_COOKIE_MAX_AGE=604800

# Client build arg
CLIENT_API_URL=https://your-domain.ru/apiback/glasses

# PostgreSQL
DB_NAME=tsoy_glasses
DB_USERNAME=postgres
DB_PASSWORD=strong-password
```

Переменные бэкенда (`S3_*`, `JWT_SECRET`) указываются в `backend/.env`.

### Первый запуск

```bash
# 1. Запустить без nginx (чтобы certbot получил сертификат)
docker compose up -d postgres backend

# 2. Запустить certbot и получить сертификат
docker compose up -d certbot nginx

# 3. После получения сертификата поднять всё
docker compose up -d

# 4. Создать первого администратора
curl -X POST https://your-domain.ru/apiback/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"your-password"}'
```

### Обновление

```bash
docker compose build && docker compose up -d
```

---

## 12. Частые проблемы и их решения

### Клиент: пустой экран / ничего не происходит

1. DevTools → Console: `XR8 is not defined` — файлы `client/external/` не попали в сборку
2. Проверить `client/.env` — `API_URL` должен быть заполнен и включать `/apiback/glasses`

### Модель не появляется на лице

1. Проверить `?modelId=<UUID>` в URL
2. DevTools → Network — запрос к бэкенду должен вернуть 200
3. DevTools → Console — искать `[scene] face mesh found` и `[scene] model attached to face anchor`
4. Если `face mesh found` нет — 8th Wall не нашёл лицо (плохое освещение, неподходящая камера)

### Adminka: слайдеры есть, но превью не обновляется

1. Проверить `VITE_CLIENT_URL` в `admin/.env` — должен указывать на работающий клиент
2. DevTools → Console в контексте iframe (переключить контекст в DevTools)

### CORS ошибки

```
Access to fetch at '...' has been blocked by CORS policy
```

Бэкенд создаётся с `{ cors: true }`. Если ошибка всё равно есть — проверить, что `VITE_BASE_URL` правильный и бэкенд запущен.

### Страница входа после перезагрузки (бесконечный loop)

Если `VITE_COOKIE_NAME` или `VITE_COOKIE_MAX_AGE` не заданы — cookie не сохраняется и пользователь каждый раз попадает на `/auth/login`.

### `rotation` сохранилось неправильно

Проверить, что при `PATCH` отправляется кватернион. Если в теле запроса три числа вместо четырёх — это Эйлер. В коде `App.jsx` перед отправкой вызывается `eulerDegToQuat()`.

### Масштаб после перезагрузки другой

Небольшое округление при конвертации `scaleToSlider → sliderToScale` — норма (точность 5 значимых цифр). Для практической работы незначительно.

### Ошибка при `npm install`

```bash
rm -rf node_modules package-lock.json admin/node_modules client/node_modules
npm install
```

---

## Приложение: npm workspaces

Проект использует **npm workspaces** для `admin` и `client`. Корневой `npm install` ставит зависимости обоих.

```bash
# Добавить зависимость только в adminку
npm install axios --workspace=admin

# Запустить команду в конкретном воркспейсе
npm run build --workspace=client
```

`backend` — отдельный проект, не входит в workspaces. Его зависимости устанавливаются отдельно: `cd backend && npm install`.
