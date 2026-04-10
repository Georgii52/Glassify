# tsoy-glasses

AR-примерка очков на базе 8th Wall. Проект состоит из двух независимых приложений и подключается к внешнему бэкенду.

---

## Структура репозитория

```
tsoy-glasses/
├── admin/          # Панель администратора (React + Vite)
├── client/         # AR-клиент на 8th Wall (webpack + vanilla JS)
├── package.json    # npm workspaces — объединяет admin и client
└── package-lock.json
```

### `admin/`

React-приложение для настройки 3D-моделей. Открывается разработчиком или контент-менеджером.

```
admin/
└── src/
    ├── App.jsx                  # Главный компонент: загрузка конфига, сохранение, загрузка файла
    ├── App.module.css
    ├── main.jsx
    ├── index.css
    ├── components/
    │   ├── ARPreview.jsx        # iframe с клиентом + отправка команд через postMessage
    │   ├── ARPreview.module.css
    │   ├── TransformControls.jsx # Слайдеры позиции / поворота / масштаба
    │   ├── TransformControls.module.css
    │   ├── SliderRow.jsx        # Один ряд слайдера с числовым инпутом
    │   └── SliderRow.module.css
    └── utils/
        ├── math.js              # Конвертация Эйлер <-> кватернион
        └── config.js            # Хелперы работы с объектом конфига
```

### `client/`

8th Wall AR-опыт. Открывается конечным пользователем устройстве.

```
client/
├── src/
│   ├── index.html       # Точка входа: вся логика сцены в inline <script>
│   └── .expanse.json    # Граф сцены 8th Wall (face mesh, якоря, камера)
│   
├── config/
│   ├── webpack.config.js  # Сборка: HtmlWebpackPlugin подставляет API_URL
│   └── ...
└── external/            # Рантайм 8th Wall (runtime.js, xr.js) — не в git
```

---

## Запуск

Зависимости устанавливаются из корня (npm workspaces):

```bash
npm install
```

| Команда | Что запускает |
|---|---|
| `npm run admin` | Дев-сервер админки (Vite, с `--host`) |
| `npm run client` | Дев-сервер клиента (webpack-dev-server) |
| `npm run build:admin` | Продакшн-сборка админки |
| `npm run build:client` | Продакшн-сборка клиента |
| `npm run build:all` | Сборка обоих приложений |

### Переменные окружения

**admin** — файл `admin/.env`:
```
VITE_BASE_URL=https://your-backend.com/glasses
```

**client** — файл `client/.env`:
```
API_URL=https://your-backend.com/glasses
```

`API_URL` подставляется на этапе сборки через `HtmlWebpackPlugin` (`templateParameters`) в `index.html` как строка `BACKEND_URL`.

---

## API бэкенда

Оба приложения работают с одним REST API. Базовый путь — `/glasses`.

### Получить модель по UUID

```
GET /glasses/:uuid
```

Ответ:
```json
{
  "dto": {
    "position": "[0, 0, 0]",
    "rotation": "[0, 0, 0, 1]",
    "scale":    "[1, 1, 1]"
  },
  "file": {
    "base64": "<строка base64 .glb файла>"
  }
}
```

- `dto` — трансформ модели (position/rotation/scale). Rotation хранится как кватернион `[x, y, z, w]`.
- `file.base64` — сама 3D-модель в формате GLB, закодированная в base64.

### Загрузить новую модель

```
POST /glasses
Content-Type: multipart/form-data
  model: <файл .glb>
```

Ответ:
```json
{ "id": "<новый UUID>" }
```

Сервер сохраняет файл и возвращает UUID, по которому модель будет доступна.

### Обновить трансформ

```
PATCH /glasses/:uuid
Content-Type: application/json
{
  "position": [x, y, z],
  "rotation": [x, y, z, w],
  "scale":    [x, y, z]
}
```

---

## Загрузка модели по UUID

Оба приложения не хранят модели локально. Загрузка всегда происходит по UUID, который передаётся в URL как query-параметр `?modelId=<UUID>`.

### Клиент

```
https://client.example.com/?modelId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

1. `index.html` читает `MODEL_ID` из `URLSearchParams`.
2. Отправляет `GET /glasses/<MODEL_ID>` на бэкенд.
3. Из ответа берёт `dto` (трансформ) и `file.base64` (GLB-файл).
4. Декодирует base64 в `ArrayBuffer`, создаёт `Blob URL` и загружает через `THREE.GLTFLoader`.
5. Модель прикрепляется к face anchor (объект `Face Mesh` из `.expanse.json`).

### Админка

```
https://admin.example.com/?modelId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

1. `App.jsx` читает `modelId` из `URLSearchParams`.
2. Отправляет `GET /glasses/<modelId>` — получает трансформ и base64 модели.
3. Инициализирует слайдеры трансформа текущими значениями с сервера.
4. Передаёт base64 в компонент `ARPreview` → тот отправляет его в iframe клиента через `postMessage`.
5. При изменении слайдеров — обновляет transform в состоянии и сразу шлёт его в iframe.
6. Кнопка «Сохранить положение» отправляет `PATCH /glasses/<modelId>` с текущим трансформом.

---

## Различия клиента и админки

| | Клиент | Админка |
|---|---|---|
| **Аудитория** | Конечный пользователь | Разработчик / контент-менеджер |
| **Стек** | Vanilla JS, 8th Wall XR, Three.js, webpack | React 18, Vite, Axios |
| **Сборка** | `webpack` → `dist/bundle.js` + `index.html` | `vite build` |
| **AR-движок** | 8th Wall (face tracking, XR8) |
| **Роль** | Рендерит модель на лице пользователя | Позволяет настроить позицию/поворот/масштаб модели |
| **Загрузка модели** | `fetch` → base64 → `GLTFLoader` | Получает base64, передаёт в iframe через `postMessage` |
| **Запись данных** | Только читает с сервера | Читает и записывает (`PATCH`) |
| **Загрузка новых моделей** | Нет | Есть (`POST /glasses`, drag & drop .glb) |

### Связь админки и клиента в реальном времени

`ARPreview.jsx` встраивает клиент в `<iframe>`. Все изменения передаются через `window.postMessage`:

| Тип сообщения | Данные | Что делает клиент |
|---|---|---|
| `adminSetTransform` | `position`, `rotation`, `scale`, `hidden` | Мгновенно применяет трансформ к модели в сцене |
| `adminLoadModel` | `base64` | Декодирует и загружает новую GLB-модель |

Клиент слушает эти сообщения в обработчике `window.addEventListener('message', ...)` в `index.html`.

---

## Сцена 8th Wall (`.expanse.json`)

Граф сцены описывает объекты, которые 8th Wall рендерит при запуске клиента:

| Объект | Назначение |
|---|---|
| `Face` | Корневой face anchor (отслеживает лицо) |
| `Face Mesh` | Геометрия лица с материалом-хайдером (скрывает реальное лицо) |
| `noseBridge` | Конус-хайдер для переносицы (скрывает нос под оправой) |
| `leftCanal` / `rightCanal` | Плоскости-хайдеры для ушных каналов |
| `Camera (2)` | Перспективная камера с face XR режимом |
| `Directional Light` | Направленный источник света |

Загружаемая GLB-модель (очки) прикрепляется к `faceMeshObj.parent` динамически через `THREE.js`.
