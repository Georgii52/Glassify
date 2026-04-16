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
6. [Админка — панель настройки моделей](#6-админка--панель-настройки-моделей)
7. [Связь Admin ↔ Client через postMessage](#7-связь-admin--client-через-postmessage)
8. [API бэкенда (NestJS)](#8-api-бэкенда-nestjs)
9. [Формат трансформов — важно не перепутать](#9-формат-трансформов--важно-не-перепутать)
10. [Сборка и деплой](#10-сборка-и-деплой)
11. [Частые проблемы и их решения](#11-частые-проблемы-и-их-решения)
12. [Вопросы по функциональности админки](#12-вопросы-по-функциональности-админки)

---

## 1. Что это вообще такое

Это система AR-примерки очков. Пользователь открывает ссылку в браузере телефона, камера включается, 8th Wall находит лицо — и на него накладывается 3D-модель очков.

Система состоит из **трёх частей**:

| Часть                | Кто использует                 | Задача                                        |
| -------------------- | ------------------------------ | --------------------------------------------- |
| **client**           | Конечный пользователь          | Рендерит AR сцену с очками на лице            |
| **admin**            | Разработчик / контент-менеджер | Настраивает положение/поворот/масштаб модели  |
| **backend (NestJS)** | Оба приложения                 | Хранит GLB-файлы и трансформы, отдаёт по UUID |

Клиент и админка — два **независимых** приложения. Они не знают друг о друге напрямую, связываются через backend (для данных) и через `postMessage` (для realtime-превью).

---

## 2. Структура репозитория

```
tsoy-glasses/
├── admin/                  # React-приложение (Vite)
│   ├── src/
│   │   ├── App.jsx                  # Главный компонент
│   │   ├── components/
│   │   │   ├── ARPreview.jsx        # iframe с клиентом
│   │   │   ├── TransformControls.jsx # Слайдеры позиция/поворот/масштаб
│   │   │   └── SliderRow.jsx        # Один ряд слайдера
│   │   └── utils/
│   │       ├── math.js              # Эйлер ↔ кватернион, логарифм масштаба
│   │       └── config.js            # Конвертация объекта конфига в UI-трансформ
│   └── .env                         # Переменные окружения (создать вручную)
│
├── client/                 # 8th Wall AR (webpack + vanilla JS)
│   ├── src/
│   │   ├── index.html               # Точка входа. ВСЯ логика сцены — здесь, в inline <script>
│   │   └── .expanse.json            # Граф сцены 8th Wall
│   ├── config/
│   │   └── webpack.config.js        # Сборка: вставляет API_URL в index.html
│   ├── external/                    # 8th Wall runtime (НЕ в git, положить вручную)
│   └── .env                         # Переменные окружения (создать вручную)
│
├── package.json            # npm workspaces — объединяет оба приложения
└── package-lock.json
```

### Почему `external/` не в git?

Папка `client/external/` содержит проприетарный 8th Wall runtime (`runtime.js`, `xr.js` и ресурсы).
Эти файлы **нельзя коммитить** — они скачиваются/предоставляются отдельно через 8th Wall Cloud Studio или developer portal. Без них клиент не запустится (будет пустая страница, в консоли ошибки про `XR8` is not defined).

---

## 3. Как запустить локально

### Шаг 1 — Установить зависимости

```bash
# Из корня репозитория. npm workspaces сам поставит зависимости обоих приложений.
npm install
```

### Шаг 2 — Создать .env файлы

В репозитории есть `admin/.env.example` — скопировать его как `.env` и заполнить:

```bash
cp admin/.env.example admin/.env
```

**`admin/.env`:**

```
VITE_BASE_URL=http://localhost:3000
VITE_CLIENT_URL=http://localhost:8080
```

**`client/.env`:**

```
API_URL=http://localhost:3000/glasses
```

> Подробнее про эти переменные — в разделе [Переменные окружения](#4-переменные-окружения).

### Шаг 3 — Убедиться, что есть `external/`

Скопировать 8th Wall runtime в `client/external/`. Структура должна быть:

```
client/external/
├── runtime/
│   └── runtime.js
└── xr/
    └── xr.js
```

### Шаг 4 — Запустить

```bash
# Запустить клиент (webpack-dev-server, порт 8080)
npm run client

# Запустить админку (Vite, порт 5173, доступна по сети с --host)
npm run admin
```

Каждая команда запускается **в отдельном терминале**.

### Как открыть

| Приложение | URL                                     |
| ---------- | --------------------------------------- |
| Клиент     | `http://localhost:8080/?modelId=<UUID>` |
| Админка    | `http://localhost:5173/?modelId=<UUID>` |

> `modelId` — это UUID модели на бэкенде. Без него оба приложения просто ничего не загружают.

---

## 4. Переменные окружения

### Админка (`admin/.env`)

Образец: `admin/.env.example` — скопировать и заполнить своими значениями.

```
VITE_BASE_URL=https://your-backend.com
VITE_CLIENT_URL=https://client.your-domain.com
```

`VITE_BASE_URL` используется как префикс всех запросов к API:

- `GET  ${VITE_BASE_URL}/glasses/<uuid>`
- `POST ${VITE_BASE_URL}/glasses`
- `PATCH ${VITE_BASE_URL}/glasses/<uuid>`

> Обрати внимание: в adminке URL без `/glasses` в конце — путь дописывается в коде.
> Переменная доступна через `import.meta.env.VITE_BASE_URL` (Vite convention).

### Клиент (`client/.env`)

```
API_URL=https://your-backend.com/glasses
```

Это значение **встраивается в HTML на этапе сборки** через `webpack.config.js`:

```js
// webpack.config.js
templateParameters: {
  API_URL: process.env.API_URL || '',
},
```

В `index.html` оно подставляется так:

```html
<script>
const BACKEND_URL = '<%= API_URL %>'
```

После сборки в `dist/index.html` будет буквально:

```html
const BACKEND_URL = 'https://your-backend.com/glasses'
```

**Важно:** если сборку сделать без `.env`, в HTML попадёт пустая строка, и все fetch запросы будут идти на пустой URL. Это молча провалится.

---

## 5. Клиент — AR-примерка (8th Wall)

### Технологии

- **Vanilla JS** (весь код — один `<script>` в `index.html`)
- **8th Wall XR** — face tracking через камеру
- **Three.js** — рендеринг 3D
- **webpack** — сборка

### Точка входа

Вся логика клиента находится в одном файле: `client/src/index.html`, в теге `<script>` в конце `<body>`.

webpack собирает `entry.js` (виртуальный, генерируется плагином `entry-plugin.js`) в `bundle.js`, а `index.html` подставляется через `HtmlWebpackPlugin` с заменой `<%= API_URL %>`.

### Что делает клиент при загрузке

```
1. Читает ?modelId= из URL
2. Показывает лоадер (progress bar)
3. Запрашивает GET /glasses/<modelId> с бэкенда
4. Получает dto (трансформ) и file.base64 (GLB)
5. Применяет трансформ к pendingTransform
6. Декодирует base64 → ArrayBuffer → Blob URL
7. Загружает GLB через THREE.GLTFLoader
8. Ждёт, пока 8th Wall найдёт face mesh объект
9. Прикрепляет модель к faceMeshObj.parent (face anchor)
10. Прячет лоадер
```

### Как работает face tracking

8th Wall при старте создаёт граф объектов из `.expanse.json`. Там есть `Face Mesh` — Three.js меш с геометрией лица.

Клиент не знает заранее, какой именно объект является face mesh, поэтому ищет его так:

```js
// Перебирает все объекты сцены и берёт первый меш с > 400 вершинами
// (геометрия лица очень детальная, у случайных объектов столько не будет)
xrScene.scene.traverse((obj) => {
  if (obj.isMesh && obj.geometry?.attributes?.position?.count > 400) {
    faceMeshObj = obj;
  }
});
```

Модель очков прикрепляется к `faceMeshObj.parent` — это face anchor, который двигается вместе с лицом.

### Pending transform

Есть тонкость: модель загружается асинхронно, а трансформ с сервера может прийти раньше, чем GLTFLoader закончит работу.

Поэтому используется `pendingTransform`:

```js
function applyTransform(d) {
  if (!loadedModel) {
    pendingTransform = d; // Сохраняем, применим когда модель загрузится
    return;
  }
  // Применяем сразу
  loadedModel.position.set(...d.position);
  loadedModel.quaternion.set(...d.rotation);
  loadedModel.scale.set(...d.scale);
}
```

После загрузки модели `pendingTransform` применяется сразу.

### Слушатель postMessage

Клиент умеет принимать команды от родительской страницы (из `iframe`):

```js
window.addEventListener("message", (e) => {
  const d = e.data;
  if (d.type === "adminSetTransform") applyTransform(d);
  if (d.type === "adminLoadModel") loadModelFromBase64(d.base64);
});
```

Это и есть мост между админкой и клиентом.

---

## 6. Админка — панель настройки моделей

### Технологии

- **React 18** + **Vite**
- **Axios** для HTTP запросов
- CSS Modules для стилей

### Как открыть

```
http://localhost:5173/?modelId=<UUID>
```

Без `modelId` в URL — страница покажет ошибку, это нормально.

### Что делает при загрузке

```
1. Читает ?modelId= из URL (URL_MODEL_ID)
2. Запрашивает GET /glasses/<modelId>
3. Получает dto (трансформ в кватернионах) и file.base64
4. Конвертирует кватернион → углы Эйлера (для слайдеров)
5. Заполняет слайдеры текущими значениями
6. Передаёт base64 в компонент ARPreview
```

### ARPreview и iframe

`ARPreview.jsx` — это компонент, который рендерит клиент в `<iframe>`:

```jsx
<iframe
  src={AR_URL}
  allow="camera; microphone; accelerometer; gyroscope; xr-spatial-tracking"
  ...
/>
```

URL берётся из переменной окружения `VITE_CLIENT_URL` (`admin/.env`):

```js
// admin/src/components/ARPreview.jsx
const AR_URL = import.meta.env.VITE_CLIENT_URL;
```

Локально это `http://localhost:8080`, в продакшне — адрес задеплоенного клиента.
Если переменная не задана, `AR_URL` будет `undefined`, iframe не загрузится.

Когда пользователь двигает слайдер, изменения немедленно летят в iframe через `postMessage` — AR превью обновляется в реальном времени без перезагрузки.

### Кнопка «Сохранить положение»

Отправляет `PATCH /glasses/<uuid>` с текущим трансформом. **Rotation отправляется как кватернион** — конвертация из Эйлера происходит в `applyTransformToConfig`:

```js
cfg.objects[id].rotation = eulerDegToQuat(...t.rotation);
```

### Кнопка «Сбросить до значений по умолчанию»

Возвращает слайдеры к значениям, которые были получены с сервера при загрузке страницы. Не делает PATCH — только локальный сброс в UI.

### Загрузка новой модели

Секция «Загрузить новую модель» (скрытая под `<details>`):

- Drag & drop или клик для выбора `.glb` файла
- Отправляет `POST /glasses` с `multipart/form-data` (поле `model`)
- Получает `{ id: "<новый UUID>" }` в ответ
- Добавляет модель в локальный конфиг

---

## 7. Связь Admin ↔ Client через postMessage

Это самая нетривиальная часть архитектуры. Разберём пошагово.

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
  modelName: 'Модель abc-123',
  position: [0.0, -0.05, 0.0],     // [x, y, z] в метрах
  rotation: [0.0, 0.0, 0.0, 1.0],  // кватернион [x, y, z, w]
  scale:    [0.5, 0.5, 0.5],       // [x, y, z]
  hidden:   false,
}
```

> **Rotation здесь — кватернион!** В UI слайдеры показывают углы в градусах (Эйлер),
> но перед отправкой `eulerDegToQuat()` конвертирует их в кватернион.

#### `adminLoadModel`

```js
{
  type: 'adminLoadModel',
  base64: '<строка base64 GLB файла>',
}
```

### Проблема гонки: iframe ещё не загрузился

Есть edge case: `postMessage` нельзя отправить в iframe, если он ещё не загрузил страницу. Это решается через `pendingRef`:

```js
// ARPreview.jsx
const pendingRef = useRef(null);

// Запоминаем последнее состояние при каждом изменении
useEffect(() => {
  pendingRef.current = { modelName, transform };
  sendTransform(iframe, modelName, transform);
}, [modelName, transform]);

// Когда iframe загрузится — отправляем сохранённое состояние
function handleLoad() {
  if (modelBase64) sendModel(iframe, modelBase64);
  const p = pendingRef.current;
  if (p) sendTransform(iframe, p.modelName, p.transform);
}
```

---

## 8. API бэкенда (NestJS)

Оба приложения работают с одним REST API. Вот что бэкенд **обязан** реализовать.

### `GET /glasses/:uuid`

Возвращает трансформ и GLB файл по UUID.

**Response:**

```json
{
  "dto": {
    "position": "[0, 0, 0]",
    "rotation": "[0, 0, 0, 1]",
    "scale": "[1, 1, 1]"
  },
  "file": {
    "base64": "<строка base64>"
  }
}
```

**Нюансы:**

- `position`, `rotation`, `scale` могут быть либо строкой JSON (`"[0, 0, 0]"`), либо уже массивом (`[0, 0, 0]`). Оба клиента обрабатывают оба варианта через:
  ```js
  const parseArr = (v) => (Array.isArray(v) ? v : JSON.parse(v));
  ```
  Но лучше отдавать **массив**, это чище.
- `rotation` — **кватернион** в формате `[x, y, z, w]`. Не Эйлер, не матрица. Именно кватернион.
- `file.base64` — GLB файл, закодированный в base64. Это может быть несколько мегабайт строки. Клиент декодирует это сам.

### `POST /glasses`

Загружает новую модель.

**Request:** `multipart/form-data`, поле `model` — файл `.glb`.

**Response:**

```json
{ "id": "<новый UUID>" }
```

### `PATCH /glasses/:uuid`

Обновляет трансформ модели.

**Request body:**

```json
{
  "position": [0.0, -0.05, 0.0],
  "rotation": [0.0, 0.0, 0.0, 1.0],
  "scale": [0.5, 0.5, 0.5]
}
```

Все три поля — массивы числа `[x, y, z]` или `[x, y, z, w]` для rotation.

### CORS

Бэкенд должен разрешать запросы от origin'ов клиента и админки. При локальной разработке это как минимум:

- `http://localhost:5173` (admin Vite)
- `http://localhost:8080` (client webpack-dev-server)

Webpack-dev-server клиента уже выставляет CORS заголовки для своего сервера:

```js
headers: {
  'Access-Control-Allow-Origin': '*',
  ...
}
```

Но это только для webpack — **NestJS бэкенд тоже должен иметь CORS включённым**.

### Где лежат файлы на бэкенде

Это детали реализации NestJS, но логика такая:

- При `POST /glasses` сервер сохраняет GLB и создаёт запись в БД с UUID
- При `GET /glasses/:uuid` читает файл, кодирует в base64 и возвращает вместе с трансформом из БД
- При `PATCH /glasses/:uuid` обновляет поля position/rotation/scale в БД

---

## 9. Формат трансформов — важно не перепутать

Это главное место, где легко запутаться. Вот полная картина.

### Где что хранится

| Место                                 | Формат rotation                           |
| ------------------------------------- | ----------------------------------------- |
| База данных (backend)                 | Кватернион `[x, y, z, w]`                 |
| API ответ `dto.rotation`              | Кватернион `[x, y, z, w]`                 |
| Слайдеры в UI (adminка)               | Углы Эйлера в **градусах** `[rx, ry, rz]` |
| `postMessage adminSetTransform`       | Кватернион `[x, y, z, w]`                 |
| Three.js `quaternion.set(x, y, z, w)` | Кватернион `[x, y, z, w]`                 |

### Где происходит конвертация

```
API (кватернион) → modelToTransform() → UI state (Эйлер в градусах)
                                              ↓
                              пользователь двигает слайдер
                                              ↓
UI state (Эйлер) → eulerDegToQuat() → postMessage / PATCH (кватернион)
```

Конкретные функции в `admin/src/utils/math.js`:

- **`quatToEulerDeg(qx, qy, qz, qw)`** — кватернион → градусы Эйлера (XYZ порядок)
- **`eulerDegToQuat(rx, ry, rz)`** — градусы Эйлера → кватернион

### Логарифмический масштаб слайдера

Слайдер масштаба работает **не линейно** — он логарифмический. Диапазон `0..1000` (целые числа) маппится на реальные значения от `0.0001` до `25`.

Это сделано для удобства: при линейном слайдере большая часть его хода была бы занята значениями 0..1, и тонкая настройка была бы невозможна.

```js
// admin/src/utils/math.js
const LOG_MIN = 0.0001
const LOG_MAX = 25

export function scaleToSlider(v)  // реальное значение → позиция слайдера 0..1000
export function sliderToScale(s)  // позиция слайдера 0..1000 → реальное значение
```

---

## 10. Сборка и деплой

### Команды

```bash
npm run build:admin    # Собирает adminку в admin/dist/
npm run build:client   # Собирает клиент в client/dist/
npm run build:all      # Оба сразу
```

### Клиент после сборки

`client/dist/` содержит:

```
dist/
├── index.html      ← API_URL уже вшит как строка в JS
├── bundle.js       ← весь JS клиента
├── external/       ← скопирован из client/external/ (8th Wall runtime)
└── expanse.json    ← граф сцены 8th Wall
```

Это статические файлы. Их можно положить в S3, Nginx, CDN.

### Админка после сборки

`admin/dist/` — стандартная Vite-сборка:

```
dist/
├── index.html
└── assets/
    ├── index-xxx.js
    └── index-xxx.css
```

### AR_URL для продакшна

`AR_URL` берётся из переменной окружения `VITE_CLIENT_URL`. Перед продакшн-сборкой убедиться, что в `admin/.env` указан правильный URL задеплоенного клиента:

```
VITE_CLIENT_URL=https://client.your-domain.com
```

### Обязательно HTTPS в продакшне

**Клиент (AR) работает только по HTTPS.** Браузер блокирует Camera API на незащищённых соединениях — пользователь не увидит запроса на доступ к камере, AR просто не запустится.

Это касается только продакшна: `localhost` считается secure context и работает по HTTP.

Решение: любой HTTPS — Nginx + Let's Encrypt, CloudFlare, AWS, Vercel, etc.

### Проверка `external/` перед сборкой

Перед `npm run build:client` автоматически запускается `scripts/check-external.js`, который проверяет наличие 8th Wall runtime файлов. Если их нет — сборка упадёт с понятным сообщением вместо молчаливой поломки:

```
❌ Отсутствуют файлы 8th Wall runtime:
   client/external/runtime/runtime.js
   client/external/xr/xr.js
```

В CI/CD нужно добавить шаг, который восстанавливает эти файлы (из artifact storage, S3, или другого источника) **до** запуска `npm run build:client`.

---

## 11. Частые проблемы и их решения

### Клиент открывается, но ничего не происходит / пустой экран

1. Проверить `client/external/` — там должны быть `runtime/runtime.js` и `xr/xr.js`
2. Открыть DevTools → Console. Если есть `XR8 is not defined` — файлов runtime нет
3. Проверить `client/.env` — `API_URL` должен быть заполнен

### Модель не появляется на лице

1. Проверить, что в URL есть `?modelId=<корректный UUID>`
2. DevTools → Network — должен быть запрос к бэкенду, и он должен вернуть 200
3. DevTools → Console — искать сообщения `[scene] face mesh found` и `[scene] model attached to face anchor`
4. Если `face mesh found` нет — 8th Wall не нашёл лицо (плохое освещение, камера не та)

### Adminка: слайдеры есть, но превью не обновляется

1. Проверить переменную `VITE_CLIENT_URL` в `admin/.env` — она должна указывать на работающий клиент
2. Проверить, что клиент действительно запущен и доступен по этому адресу
3. DevTools → Console в контексте iframe (переключить контекст в DevTools) — проверить ошибки

### CORS ошибки в браузере

```
Access to fetch at 'http://localhost:3000' from origin 'http://localhost:5173' has been blocked by CORS policy
```

NestJS бэкенд должен быть настроен с CORS. В `main.ts` NestJS:

```ts
app.enableCors({
  origin: ["http://localhost:5173", "http://localhost:8080"],
  methods: ["GET", "POST", "PATCH"],
});
```

### `rotation` сохранилось в БД неправильно — модель смотрит не туда

Проверить, что при `PATCH` отправляется кватернион, а не Эйлер. В коде `App.jsx` перед отправкой вызывается `eulerDegToQuat()`. Если бэкенд хранит данные как-то иначе — нужна согласованность формата.

### Масштаб выглядит правильно в превью, но после перезагрузки другой

Это может быть из-за округления при конвертации `scaleToSlider → sliderToScale`. Значения хранятся с точностью 5 значимых цифр (`toPrecision(5)`). Это нормально для практической работы.

### npm install падает с ошибками

Попробовать удалить `node_modules` и `package-lock.json` и установить заново:

```bash
rm -rf node_modules package-lock.json admin/node_modules client/node_modules
npm install
```

---

## 12. Вопросы по функциональности админки

На этапе текущей разработки админка реализована как **инструмент для работы с одной конкретной моделью по UUID**. Каталог моделей, авторизация и управление списком не проектировались — это задел для следующего этапа разработки.

---

**1. Как происходит вход в админ панель?**

Никакой авторизации нет. Доступ осуществляется напрямую по URL с параметром `modelId`:

```
https://admin.your-domain.com/?modelId=<UUID>
```

Кто знает URL — тот имеет доступ. Разграничение доступа на данном этапе не предусмотрено.

---

**2. Как просматривать / редактировать / сохранять модель?**

Работа ведётся с одной моделью за раз через URL-параметр. Подробнее — в [разделе 6 (Админка)](#6-админка--панель-настройки-моделей).

Краткий сценарий:
- Открыть `?modelId=<UUID>` — автоматически загрузится модель и её текущий трансформ
- Двигать слайдеры позиции / поворота / масштаба — превью обновляется в реальном времени
- Нажать «Сохранить положение» — отправляет `PATCH /glasses/<uuid>` на бэкенд
- «Сбросить до значений по умолчанию» — откатывает слайдеры к значениям, загруженным с сервера при открытии страницы (не делает запрос на сервер)

---

**3. Как просматривать список загруженных моделей?**

На данном этапе это не проектировалось — каталога моделей нет. Планируется в следующем этапе разработки.

---

**4. Как удалять модели?**

На данном этапе это не проектировалось — кнопки удаления нет ни в UI, ни в API (`DELETE /glasses/:uuid` не реализован). Планируется в следующем этапе разработки.

---

**5. Как при редактировании возвращаться к общему списку моделей?**

Общего списка пока нет — возвращаться некуда. Планируется в следующем этапе разработки.

---

**6. Где прописывается название модели?**

Сейчас название генерируется автоматически из UUID:

```js
// admin/src/App.jsx
const MODEL_NAME = `Модель ${URL_MODEL_ID}`
```

Отдельного поля «название» в API нет. Если при загрузке новой модели через drag & drop указать файл `my-model.glb`, то именем станет имя файла. Полноценное задание имени при создании/редактировании не предусмотрено на данном этапе.

---

**7. Будет ли поиск по списку моделей?**

На данном этапе это не проектировалось — списка нет, поиска нет. Планируется в следующем этапе разработки.

---

**8. Какие поля присутствуют в карточке модели?**

На данный момент бэкенд и API работают со следующими полями:

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID | Уникальный идентификатор |
| `position` | `[x, y, z]` | Позиция модели |
| `rotation` | `[x, y, z, w]` | Поворот (кватернион) |
| `scale` | `[x, y, z]` | Масштаб |
| `file.base64` | string | GLB-файл в base64 |

Полей `name`, `description`, `tags`, `thumbnail` и других метаданных на данный момент нет. Их добавление предполагается при разработке каталога.

---

## Приложение: npm workspaces

Проект использует **npm workspaces**. Это значит:

- `npm install` в корне ставит зависимости **для обоих** приложений
- `node_modules` создаётся в корне (общие зависимости) и в каждом воркспейсе (уникальные)
- Команды можно запускать для конкретного воркспейса: `npm run build --workspace=client`

Если нужно добавить зависимость только в одно приложение:

```bash
npm install axios --workspace=admin
```
