# Документация формата обмена проектами v2.0

## Обзор

Новый формат обмена проектами между клиентом и сервером разработан для решения следующих задач:
- Версионирование формата данных
- Разделение метаданных и контента
- Оптимизация передачи больших матриц
- Поддержка совместной работы
- Расширенные возможности поиска и фильтрации

## Структура формата данных

### Основной пакет (Payload)

```json
{
  "meta": {
    "formatVersion": "2.0",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "operation": "create|update|delete|load|list|share|export|import",
    "clientId": "client_abc123_1705312200000",
    "compression": "low|medium|high"
  },
  "project": {
    "id": "proj_unique_id",
    "name": "Название проекта",
    "type": "thermal_image|graphic_editor|analysis|composite",
    "status": "draft|published|archived|locked",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z",
    "owner": "username",
    "permissions": {
      "read": true,
      "write": true,
      "delete": true,
      "share": false
    },
    "category": "category_name",
    "tags": ["tag1", "tag2"],
    "description": "Описание проекта",
    "settings": {
      "theme": "light|dark",
      "defaultView": "list|grid",
      "notifications": true,
      "autoSave": true,
      "syncEnabled": true
    },
    "files": [
      {
        "id": "file_1",
        "filename": "image.tpt",
        "size": 1048576,
        "dimensions": {"width": 1920, "height": 1080},
        "checksum": "a1b2c3d4e5f6",
        "hasContent": true
      }
    ]
  },
  "content": {
    "files": [
      {
        "fileId": "file_1",
        "matrix": {
          "format": "base64|base64_delta|null",
          "encoding": "float32|int16|uint8",
          "dimensions": [1080, 1920],
          "deltaBase": 0.0,
          "data": "base64_encoded_string"
        },
        "minValue": 0.0,
        "maxValue": 255.0,
        "colormap": "plasma",
        "history": []
      }
    ]
  },
  "checksum": "package_checksum_16chars"
}
```

## Форматы кодирования матриц

### Base64 (стандартный)
Используется для матриц размером < 1MB:
```json
{
  "format": "base64",
  "encoding": "float32",
  "dimensions": [rows, cols],
  "data": "base64_encoded_string"
}
```

### Base64 + Delta (сжатый)
Используется для больших матриц с высоким уровнем сжатия:
```json
{
  "format": "base64_delta",
  "encoding": "int16",
  "dimensions": [rows, cols],
  "deltaBase": first_value,
  "data": "delta_encoded_base64_string"
}
```

### Алгоритм Delta-кодирования
1. Первое значение сохраняется как есть (deltaBase)
2. Каждое последующее значение заменяется разностью с предыдущим
3. Результат округляется до int16 для экономии места

## API Endpoints

### Сохранение проекта
```http
POST /api/projects/save
Content-Type: application/json

{
  "meta": {...},
  "project": {...},
  "content": {...},
  "checksum": "..."
}

Response:
{
  "success": true,
  "project_id": "proj_id",
  "object_name": "projects/proj_id.json",
  "format_version": "2.0",
  "message": "Project saved successfully"
}
```

### Загрузка проекта
```http
GET /api/projects/load/<project_id>?includeContent=true&includeHistory=true

Response:
{
  "success": true,
  "meta": {...},
  "project": {...},
  "content": {...},
  "checksum": "..."
}
```

**Параметры запроса:**
- `includeContent` (true/false) - включать ли данные матриц
- `includeHistory` (true/false) - включать ли историю изменений

### Список проектов
```http
GET /api/projects/list?type=thermal_image&status=published&limit=20&offset=0&search=query

Response:
{
  "success": true,
  "projects": [
    {
      "id": "proj_1",
      "name": "Project 1",
      "type": "thermal_image",
      "status": "published",
      "category": "",
      "owner": "user",
      "createdAt": "...",
      "updatedAt": "...",
      "tags": [],
      "fileCount": 2
    }
  ],
  "count": 1,
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

**Параметры фильтрации:**
- `type` - тип проекта
- `status` - статус проекта
- `category` - категория
- `owner` - владелец
- `search` - поиск по названию и описанию
- `limit` - количество результатов (по умолчанию 100)
- `offset` - смещение для пагинации

### Удаление проекта
```http
DELETE /api/projects/delete/<project_id>

Response:
{
  "success": true,
  "project_id": "proj_id",
  "message": "Project deleted successfully"
}
```

### Экспорт проекта
```http
GET /api/projects/export/<project_id>?format=json

Response: File download (application/json)
```

## Класс ProjectManager (JavaScript)

### Основные методы

#### serializeProject(project, options)
Сериализует проект в формат для отправки на сервер.

**Опции:**
- `includeHistory` (boolean) - включать историю изменений
- `includeThumbnails` (boolean) - включать контент файлов
- `compressionLevel` (string) - 'low', 'medium', 'high'
- `deltaOnly` (boolean) - только дельта-изменения

#### deserializeProject(payload)
Десериализует проект из формата сервера.

#### saveProject(project, options)
Сохраняет проект на сервер.

#### loadProject(projectId, options)
Загружает проект с сервера.

#### listProjects(filters)
Получает список проектов с фильтрацией.

#### deleteProject(projectId)
Удаляет проект.

#### exportProject(projectId, format)
Экспортирует проект в файл.

### Callbacks

```javascript
projectManager.on('onSave', (result) => {
    console.log('Проект сохранён:', result);
});

projectManager.on('onLoad', (project) => {
    console.log('Проект загружен:', project);
});

projectManager.on('onDelete', ({projectId}) => {
    console.log('Проект удалён:', projectId);
});
```

## Примеры использования

### Сохранение проекта
```javascript
const project = {
    id: 'proj_' + Date.now(),
    name: 'Мой проект',
    type: 'thermal_image',
    files: [/* файлы */]
};

const result = await projectManager.saveProject(project, {
    includeHistory: true,
    compressionLevel: 'medium'
});

if (result.success) {
    console.log('Сохранено успешно');
}
```

### Загрузка проекта
```javascript
try {
    const project = await projectManager.loadProject('proj_123', {
        includeContent: true,
        includeHistory: true
    });
    console.log('Проект загружен:', project.name);
} catch (error) {
    console.error('Ошибка загрузки:', error);
}
```

### Поиск проектов
```javascript
const projects = await projectManager.listProjects({
    type: 'thermal_image',
    status: 'published',
    search: 'тепловизор'
});

console.log(`Найдено проектов: ${projects.length}`);
```

## Обратная совместимость

Старые endpoints сохраняются для обратной совместимости:
- `/save_project` → используйте `/api/projects/save`
- `/load_project/<id>` → используйте `/api/projects/load/<id>`
- `/list_projects` → используйте `/api/projects/list`
- `/delete_project/<id>` → используйте `/api/projects/delete/<id>`

## Миграция со старой версии

1. Обновите клиентский код на использование `projectManager`
2. Обновите вызовы API на новые endpoints
3. Старые проекты будут автоматически конвертироваться при загрузке

## Контрольные суммы

Каждый файл и весь пакет в целом имеют контрольную сумму SHA-256 (обрезанную до 16 символов) для проверки целостности данных.

## Безопасность

- Проверка прав доступа перед операциями
- Валидация формата данных
- Ограничение размера загружаемых файлов
- Логирование всех операций
