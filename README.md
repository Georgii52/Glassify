# Glassify-app

AR-примерка очков на базе 8th Wall. Состоит из трёх приложений: AR-клиент, панель администратора и бэкенд.

---

## Структура репозитория

```
tsoy-glasses/
├── admin/          # Панель администратора (React + Vite + React Router)
├── client/         # AR-клиент на 8th Wall (webpack + vanilla JS)
├── backend/        # REST API (NestJS + TypeORM + PostgreSQL + S3)
├── nginx/          # Конфигурация Nginx reverse proxy
├── docker-compose.yml
└── package.json    # npm workspaces — объединяет admin и client
```

### `admin/`

React-приложение для управления 3D-моделями. Имеет три маршрута (базовый путь `/admin`):

| Маршрут | Страница |
|---|---|
| `/admin/auth/login` | Страница входа |
| `/admin/` | Каталог моделей (защищён JWT) |
| `/admin/editor?modelId=<UUID>` | Редактор трансформов (защищён JWT) |

```
admin/src/
├── App.jsx                  # Редактор: слайдеры трансформа + AR-превью
├── main.jsx                 # Маршрутизатор (React Router v7)
├── components/
│   ├── ARPreview.jsx        # iframe с клиентом + postMessage
│   ├── ModelPreview.jsx     # Миниатюра GLB-модели в каталоге
│   ├── ProtectedRoute.jsx   # Обёртка для защищённых маршрутов
│   ├── TransformControls.jsx
│   └── SliderRow.jsx
├── contexts/
│   └── AuthContext.jsx      # JWT в cookie, axios defaults
├── pages/
│   ├── Catalog.jsx          # Список моделей, загрузка, удаление
│   └── Login.jsx            # Форма входа
└── utils/
    ├── math.js              # Конвертация Эйлер <-> кватернион, логарифм масштаба
    └── config.js            # Хелперы работы с объектом конфига
```

### `client/`

8th Wall AR-опыт. Открывается конечным пользователем на устройстве.

```
client/src/
├── index.html       # Точка входа: вся логика сцены в inline <script>
└── .expanse.json    # Граф сцены 8th Wall (face mesh, якоря, камера)
```

### `backend/`

NestJS API. Хранит модели в S3, метаданные в PostgreSQL.

```
backend/src/
├── app.controller.ts        # Маршруты /apiback/glasses
├── app.service.ts           # Бизнес-логика
├── entities/glasses.entity.ts
├── dto/create-glasses.dto.ts
├── common/S3/               # Сервис работы с S3
└── modules/auth/            # JWT аутентификация (login, register)
```

---

## Запуск

### Локальная разработка (без Docker)

Установить зависимости (npm workspaces из корня):

```bash
npm install
```

Поднять PostgreSQL и заполнить `backend/.env`, `admin/.env`, `client/.env` (см. раздел **Переменные окружения**).

```bash
# Каждая команда — в отдельном терминале
npm run admin      # Vite dev-server на порту 5173
npm run client     # webpack-dev-server на порту 8080
cd backend && npm run start:dev   # NestJS на порту 3000
```

| Приложение | URL |
|---|---|
| Клиент | `http://localhost:8080/?modelId=<UUID>` |
| Админка | `http://localhost:5173/` |
| API | `http://localhost:3000/apiback/...` |

### Docker Compose (продакшн)

```bash
docker compose up -d
```

Запускает: admin, client, backend, postgres, nginx, certbot. Nginx слушает 80/443 и проксирует:

| Путь | Сервис |
|---|---|
| `/` | client |
| `/admin/` | admin |
| `/apiback/` | backend |

---

## Переменные окружения

### `admin/.env`

```
VITE_BASE_URL=http://localhost:3000/apiback
VITE_CLIENT_URL=http://localhost:8080
VITE_COOKIE_NAME=admin_token
VITE_COOKIE_MAX_AGE=604800
```

| Переменная | Описание |
|---|---|
| `VITE_BASE_URL` | Базовый URL бэкенда (включая `/apiback`) |
| `VITE_CLIENT_URL` | URL клиента для iframe в редакторе |
| `VITE_COOKIE_NAME` | Имя cookie для хранения JWT |
| `VITE_COOKIE_MAX_AGE` | Время жизни cookie в секундах |

### `client/.env`

```
API_URL=http://localhost:3000/apiback/glasses
```

Встраивается в HTML на этапе сборки как `BACKEND_URL`.

### `backend/.env`

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=tsoy_glasses

S3_BUCKET=your-bucket
S3_REGION=your-region
S3_ENDPOINT=https://s3.your-provider.com
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret

JWT_SECRET=your-secret-key
```

---

## API бэкенда

Все маршруты с префиксом `/apiback`. Аутентификация эндпоинтов `/glasses` не требуется — достаточно JWT только для входа в UI.

### Получить список всех моделей

```
GET /apiback/glasses
```

Ответ — массив объектов:
```json
[
  {
    "id": "<UUID>",
    "name": "Название модели",
    "position": [0, 0, 0],
    "rotation": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  }
]
```

### Получить модель по UUID

```
GET /apiback/glasses/:uuid
```

Ответ:
```json
{
  "dto": {
    "name": "Название модели",
    "position": [0, 0, 0],
    "rotation": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  },
  "file": {
    "base64": "<строка base64 .glb файла>",
    "contentType": "model/gltf-binary"
  }
}
```

### Получить файл модели (поток)

```
GET /apiback/glasses/:uuid/model
```

Возвращает GLB-файл напрямую (StreamableFile, Content-Type: model/gltf-binary).

### Загрузить новую модель

```
POST /apiback/glasses
Content-Type: multipart/form-data
  model: <файл .glb>
  name: <название модели>
```

Ответ — объект созданной модели (с UUID).

### Обновить трансформ

```
PATCH /apiback/glasses/:uuid
Content-Type: application/json
{
  "name": "Название модели",
  "position": [x, y, z],
  "rotation": [x, y, z, w],
  "scale": [x, y, z]
}
```

### Удалить модель

```
DELETE /apiback/glasses/:uuid
```

Ответ: `{ "id": "<UUID>" }`. Удаляет запись из БД и файл из S3.

### Аутентификация

```
POST /apiback/auth/login
Content-Type: application/json
{ "login": "admin", "password": "secret" }
```

Ответ: `{ "id": "<UUID>", "accessToken": "<JWT>" }`

```
POST /apiback/auth/register
Content-Type: application/json
{ "login": "admin", "password": "secret" }
```

```
GET /apiback/auth/me
Authorization: Bearer <token>
```

Проверяет валидность JWT. Возвращает `{ "id": "<UUID>", "login": "admin" }` или `401`. Используется фронтендом при старте для верификации сохранённого токена.

---

## Загрузка модели по UUID

### Клиент

```
https://client.example.com/?modelId=<UUID>
```

1. Читает `modelId` из URL.
2. Запрашивает `GET /apiback/glasses/<modelId>`.
3. Декодирует `file.base64` → `ArrayBuffer` → `Blob URL`, загружает через `THREE.GLTFLoader`.
4. Прикрепляет модель к face anchor из `.expanse.json`.

### Редактор (Admin)

```
https://admin.example.com/editor?modelId=<UUID>
```

1. Читает `modelId` из URL.
2. Запрашивает `GET /apiback/glasses/<modelId>`.
3. Заполняет слайдеры трансформа, передаёт `base64` в `ARPreview` (iframe).
4. При движении слайдеров — отправляет трансформ в iframe через `postMessage`.
5. Кнопка «Сохранить положение» — `PATCH /apiback/glasses/<modelId>`.

---

## Связь Редактора и Клиента (postMessage)

`ARPreview.jsx` встраивает клиент в `<iframe>`. Сообщения:

| Тип | Данные | Действие клиента |
|---|---|---|
| `adminSetTransform` | `position`, `rotation`, `scale`, `hidden` | Применяет трансформ к модели |
| `adminLoadModel` | `base64` | Загружает новую GLB-модель |

---

## Сцена 8th Wall (`.expanse.json`)

| Объект | Назначение |
|---|---|
| `Face` | Корневой face anchor |
| `Face Mesh` | Геометрия лица с материалом-хайдером |
| `noseBridge` | Конус-хайдер для переносицы |
| `leftCanal` / `rightCanal` | Плоскости-хайдеры для ушных каналов |
| `Camera (2)` | Перспективная камера с face XR режимом |
| `Directional Light` | Направленный свет |

GLB-модель прикрепляется к `faceMeshObj.parent` динамически через Three.js.

---

## Различия клиента и редактора

| | Клиент | Редактор (Admin) |
|---|---|---|
| **Аудитория** | Конечный пользователь | Контент-менеджер |
| **Стек** | Vanilla JS, 8th Wall XR, Three.js, webpack | React 18, Vite, React Router v7, Axios |
| **AR-движок** | 8th Wall (face tracking, XR8) | — (iframe с клиентом) |
| **Роль** | Рендерит модель на лице | Редактирует трансформ модели |
| **Загрузка модели** | `fetch` → base64 → `GLTFLoader` | Получает base64, передаёт в iframe |
| **Запись данных** | Только читает | `PATCH` трансформа |
| **Авторизация** | Нет | JWT (cookie) |
