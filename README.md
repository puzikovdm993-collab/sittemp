
# WTIS (Web-based Tomograph Instrumental System)
WTIS — это веб-приложение для обработки, анализа и визуализации рентгеновских изображений. Приложение предоставляет широкий спектр инструментов для работы с матричными данными.

## Содержание

- Обзор проекта
- Архитектура
- Технологический стек
- Структура проекта
- Установка и запуск
- Конфигурация
- API Reference
- Основные функции
- Модули JavaScript
- Работа с MinIO
- История изменений


## Обзор проекта

WTIS представляет собой полнофункциональное приложение для:

- **Загрузки и отображения** изображений в различных форматах (PNG, JPG, JPEG, TPT)
- **Научной обработки данных** - работа с матрицами числовых значений
- **Полиномиальной аппроксимации** поверхностей методом наименьших квадратов
- **Применения фильтров**: медианный, Собеля, пороговый, логарифмический
- **Цветового картирования** с использованием различных колормап (hot, jet, gray, viridis)
- **Выделения областей** с помощью прямоугольника или инструмента "Лассо"
- **Сохранения результатов** в локальное хранилище или на сервер

### Ключевые возможности

1. **Многооконный интерфейс** - одновременная работа с несколькими файлами
2. **История действий** - отмена/повтор до 50 последних операций
3. **Интеграция с MinIO** - облачное хранение обработанных данных
4. **Адаптивный UI** - ленточный интерфейс в стиле графических редакторов
5. **Масштабирование** - зумирование изображений для детальной работы

## Архитектура

Приложение построено по модульной архитектуре с разделением ответственности:


curl -X POST "http://localhost:15404/save_matrix_binary/proj_1780024359932_2wcdr0" -H "Content-Type: application/json" -d @project_data.json -v
curl -X GET "http://localhost:5000/load_matrix_binary/proj_1780024359932_2wcdr0?filename=test_Recon" -H "Accept: application/json"





GET '/api/projects/<project_id>/metadata' — получение структуры проекта.
GET '/api/files/<file_id>' — получение актуального состояния файла (latest).

GET /projects/{id}/files/{file_id} — получение актуального состояния файла (latest).
GET /projects/{id}/files/{file_id}/versions/{step_id} — получение конкретной версии файла из истории.
POST /projects/{id}/files — создание нового файла (сохранение матрицы в latest и архивирование предыдущего состояния в history).
POST /projects/{id}/meta - обновление метаданных проекта



Проекты (/api/projects)
    Метод	Маршрут	            Описание	                        Тело запроса
    GET	    /api/projects	    Список всех проектов	            Нет
    POST	/api/projects	    Создание нового проекта	            JSON: { "name": "...", "description": "..." }
    GET	    /api/projects/{id}	Получение метаданных проекта	    Нет
    PUT	    /api/projects/{id}	Полное обновление проекта	        JSON: { "name": "...", "description": "..." }
    PATCH	/api/projects/{id}	Частичное обновление проекта	    JSON: { "description": "..." }
    DELETE	/api/projects/{id}	Удаление проекта и всех файлов	    Нет


Файлы (/api/projects/{projectId}/files)
    Метод	Маршрут	                                    Описание	                                                                    Тело запроса
    GET	    /api/projects/{projectId}/files	            Список файлов проекта	                                                        Нет
    GET	    /api/projects/{projectId}/files/{fileId}	Получение конкретного файла          	                                        Нет
    POST	/api/projects/{projectId}/files/{fileId}    Загрузка нового файла (обновление существующего)          	                    multipart/form-data (файл)
    PUT	    /api/projects/{projectId}/files/{fileId}	Замена актуального файла (или создание версии, если сервер поддерживает)	    multipart/form-data (файл)
    DELETE	/api/projects/{projectId}/files/{fileId}	Удаление файла (архивация)	                                                    Нет


Версии файлов (/api/projects/{projectId}/files/{fileId}/versions)
    Метод	                                                            Маршрут	Описание	                Тело запроса 
    GET	/api/projects/{projectId}/files/{fileId}/versions	            Список всех версий файла	        Нет
    GET	/api/projects/{projectId}/files/{fileId}/versions/{versionId}	Скачивание конкретной версии	    Нет
    GET	/api/projects/{projectId}/files/{fileId}/versions/latest	    Скачивание актуального файла	    Нет


    GET     /api/v1/projects/{project_id}/files/{file_id}/history               Получить всю историю изменений файла.
    GET     /api/v1/projects/{project_id}/files/{file_id}/history/{commit_id}   Получить состояние матрицы на определенный шаг истории.
    POST    /api/v1/projects/{project_id}/files/{file_id}/revert/{commit_id}    Откат состояния актуальной матрицы файла к указанному шагу.


```
curl -X POST "http://localhost:15404/api/projects/proj_1780024359932_2wcdr0/files" -H "Content-Type: application/json" -d @project_data.json -v
```


 JavaScript Fetch Example
```

// Конфигурация
const SERVER_URL = 'http://localhost:5000'; 
const PROJECT_ID = 'proj_1780024359932_2wcdr0';

// Данные файла (обычно они уже есть в вашем приложении, 
// так как вы только что сохранили проект или он загружен в память)
const fileData = {
    "id": "1780024367053-7e38769158dff",
    "filename": "test_Recon",
    // matrix здесь не обязателен для загрузки, так как мы грузим бинарник,
    // но если у вас есть ссылка на объект файла, используйте его.
};

async function loadMatrixFromServer() {
    try {
        // Формируем тело запроса. 
        // Важно: сервер ожидает структуру, содержащую массив 'files'.
        const payload = {
            "files": [fileData] 
            // Или, если сервер настроен на вложенность:
            // "project": {
            //    "files": [fileData]
            // }
        };

        console.log(`Загрузка матрицы для проекта ${PROJECT_ID}, файла ${fileData.filename}`);

        const response = await fetch(`${SERVER_URL}/load_matrix_binary/${PROJECT_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            console.log('Матрица успешно загружена');
            console.log('Размеры:', data.shape);
            
            // Матрица теперь доступна как обычный массив JavaScript
            const matrix = data.matrix;
            
            // Пример: вывод значения в точке [0][0]
            if (matrix.length > 0 && matrix[0].length > 0) {
                console.log(`Значение [0][0]: ${matrix[0][0]}`);
            }

            return matrix;
        } else {
            throw new Error(data.error || 'Ошибка сервера');
        }

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        alert('Ошибка загрузки матрицы: ' + error.message);
    }
}

// Вызов функции
loadMatrixFromServer();
```


```
async function loadMatrixWithRef(projectId, fileRef) {
    try {
        // fileRef - это строка вида "projects/proj_.../test_Recon_matrix.npy"
        // Мы можем либо сформировать URL к MinIO напрямую (если есть публичный доступ или прокси),
        // либо отправить запрос на наш бэкенд, который знает, как прочитать этот файл.
        
        // Вариант 1: Запрос к нашему Flask-серверу для десериализации
        // Бэкенд читает файл по fileRef, делает np.load и возвращает JSON
        const serverUrl = `${SERVER_URL}/load_matrix_binary/${projectId}`;
        
        // Тело запроса должно содержать информацию о файле, 
        // чтобы бэкенд знал, какой именно файл (если их несколько) или 
        // мы просто передаем сам fileRef в теле.
        
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: [{
                    matrix_ref: fileRef 
                    // В предыдущем роуте load_matrix_binary мы искали по filename.
                    // Теперь нужно обновить бэкенд, чтобы он умел искать по matrix_ref, 
                    // либо извлекать filename из пути.
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            console.log('Матрица загружена:', data.matrix.length, 'x', data.matrix[0].length);
            return data.matrix;
        } else {
            throw new Error(data.error);
        }

    } catch (error) {
        console.error('Ошибка загрузки:', error);
    }
}

// Использование:
// 1. Загружаем проект JSON из MinIO
// 2. Находим файл: const file = project.files[0];
// 3. Если есть file.matrix_ref, вызываем:
// loadMatrixWithRef(project.id, file.matrix_ref);

```
```
curl -X GET "http://localhost:15404/api/projects/proj_1780024359932_2wcdr0/files/1780024367053-7e38769158dfa" -H "Accept: application/json"-v
```

```
async function loadMatrixByFileId(projectId, fileId) {
    try {
        const url = `/api/projects/${projectId}/files/${fileId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
            console.log(`Матрица файла ${data.filename} загружена. Размеры:`, data.shape);
            return data.matrix;
        } else {
            throw new Error(data.error);
        }

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        throw error;
    }
}

// Вызов:
// loadMatrixByFileId('proj_1780024359932_2wcdr0', '1780024367053-7e38769158dff');
```


``` 
curl -X POST \
  'http://localhost:15404/api/projects/proj_1780024359932_2wcdr0/files/1780024367053-7e38769158dfa' \
  -H 'Content-Type: application/json' \
  -d '{
    "file": {
      "id": "1780024367053-7e38769158dfa",
      "filename": "example_matrix.npy",
      "matrix": [
        [1, 2, 3],
        [4, 5, 6]
      ]
    }
  }'

```

```
async function updateProjectFile(projectId, fileId, fileData) {
    const url = `/api/projects/${projectId}/files/${fileId}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Если требуется аутентификация, добавьте заголовок здесь:
                // 'Authorization': 'Bearer <your_token>'
            },
            body: JSON.stringify({ file: fileData })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Успешно обновлено:', result);
        return result;

    } catch (error) {
        console.error('Ошибка при обновлении файла:', error);
        throw error;
    }
}

// Пример использования:
const projectId = 'proj_123';
const fileId = 'file_456';
const filePayload = {
    id: fileId,
    filename: 'updated_matrix.npy',
    // Если нужно обновить матрицу, передайте массив данных:
    // matrix: [[1, 2], [3, 4]] 
    // Если нет — поле matrix можно не указывать
};

updateProjectFile(projectId, fileId, filePayload);

```








```
curl -X DELETE 'http://localhost:15404/api/projects/proj_1780024359932_2wcdr0/files/1780024367053-7e38769158dfa' -H 'Accept: application/json'

```

```
async function deleteProjectFile(projectId, fileId) {
    const url = `/api/projects/${projectId}/files/${fileId}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                // 'Authorization': 'Bearer <your_token>'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Файл успешно удален:', result);
        return result;

    } catch (error) {
        console.error('Ошибка при удалении файла:', error);
        throw error;
    }
}

// Пример использования:
deleteProjectFile('proj_123', 'file_456');

```


```
curl -X POST "http://localhost:15404/api/v1/projects/proj_1780024359932_2wcdr0/files/1780024367053-7e38769158dff/history" \
  -H "Content-Type: application/json" \
  -d '{
    "history": [
      {
        "action": "Открытие файла",
        "dpi": 2438.4,
        "colormap": "gray",
        "matrix": "projects/proj_1780024359932_2wcdr0/test_Recon_matrix.npy",
        "selection": [],
        "params": null,
        "w": 10,
        "h": 10,
        "timestamp": 1780024367054
      },
      {
        "action": "Изменение масштаба",
        "dpi": 2438.4,
        "colormap": "gray",
        "timestamp": 1780024400000
      }
    ]
  }'

```

```
const projectId = 'proj_1780024359932_2wcdr0';
const fileId = '1780024367053-7e38769158dff';
const url = `/api/v1/projects/${projectId}/files/${fileId}/history`;

const newHistoryData = [
  {
    action: "Открытие файла",
    dpi: 2438.4,
    colormap: "gray",
    matrix: "projects/proj_1780024359932_2wcdr0/test_Recon_matrix.npy",
    selection: [],
    params: null,
    w: 10,
    h: 10,
    timestamp: 1780024367054
  },
  {
    action: "Изменение масштаба",
    dpi: 2438.4,
    colormap: "gray",
    timestamp: 1780024400000
  }
];

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Если используется авторизация, добавьте заголовок, например:
    // 'Authorization': 'Bearer <ваш_токен>'
  },
  body: JSON.stringify({
    history: newHistoryData
  })
})
.then(response => {
  if (!response.ok) {
    throw new Error(`Ошибка HTTP: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  console.log('Успех:', data);
  // data будет содержать: { success: true, message: '...', historyCount: 2 }
})
.catch(error => {
  console.error('Ошибка при обновлении истории:', error);
});

```



