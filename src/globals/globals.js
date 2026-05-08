// Глобальные переменные (настройки и состояние приложения)


let currentTool = 'cursor';       // Текущий инструмент (по умолчанию — текст)
let isDrawing = false;          // Флаг, указывающий, ведётся ли рисование
let startX = 0, startY = 0;     // Начальные координаты рисунка (X и Y)
let lastX = 0, lastY = 0;       // Последние координаты курсора для плавного рисования
let zoom = 1;                   // Коэффициент масштабирования холста
let activeFileId = null;        // ID активного файла (для работы с несколькими файлами)
let canvas = null;              // Ссылка на HTML-элемент холста (оверлей)
let ctx = null;                 // Ссылка на контекст рисования холста (2D оверлей)
let imageCanvas = null;         // Ссылка на HTML-элемент нижнего слоя (изображение)
let imageCtx = null;            // Ссылка на контекст рисования нижнего слоя (изображение)
let overlayCanvas = null;       // Ссылка на HTML-элемент верхнего слоя (рисование, выделения)
let overlayCtx = null;          // Ссылка на контекст рисования верхнего слоя (рисование, выделения)

// Переменные для перемещения выделения
let isMoving = false;
let moveStartX = 0, moveStartY = 0;
let moveOffsetX = 0, moveOffsetY = 0;
let moveSelectionCanvas = null;
let moveMaskData = null;
let moveBBox = { minX:0, minY:0, maxX:0, maxY:0, width:0, height:0 };

// Переменные для работы с выделением и инструментом "Лассо" (lasso)
let selection = null;       // Объект текущего выделения 
let selectionData = null;   // Данные выделения 
let lassoPoints = [];       // Массив точек, собранных инструментом лассо
let isLassoClosed = false;  // Флаг, указывающий, замкнута ли область лассо

// Переменные для профиля
let currentProfile = null;              // Текущий профиль
let dragMode = 'none';                  // Режим перетаскивания (none, move, scale, rotate)
let dragOffsetX = 0, dragOffsetY = 0;   // Смещение для перетаскивания (для drag-and-drop)
let originalProfile = null;             // Исходный профиль до трансформации (для отмены изменений)  

// DOM-элементы (заполняются в main.js)
let dom = {};

// Константы
const maxHistory = 50;  // Максимальное количество шагов в истории (undo/redo)
const RECENT_FILES_KEY = 'tis_recent_files';// Ключ для хранения в IndexedDB списка недавних файлов
const MAX_RECENT_FILES = 10;// Максимальное количество файлов в списке "Недавно открытые"



// Создание объекта session
const session = {
    aperture: 3,
    saveName:"result",
    saveFormat:"tpt",
    normbegin: 0,
    normend: 2,
    node_orderApproximation:3,
    thresholdmin:0,
    thresholdlessmin:0,
    thresholdmax:1,
    thresholdmoremax:1
};
let project = null;

/**
 * Выводит объект проекта в консоль с форматированием
 * @param {Project} project - объект проекта для вывода
 */
    function logProject(project) {
    if (!project || !(project instanceof Project)) {
        console.error('Ошибка: передан некорректный объект проекта');
        return;
    }

    console.groupCollapsed('📌 Информация о проекте'); // Группируем вывод для удобства
    
    // Базовые свойства проекта
    console.log('🔹 ID проекта:', project.id);
    console.log('🔹 Тип проекта:', project.type);
    console.log('🔹 Дата создания:', new Date(project.createdAt).toLocaleString());
    console.log('🔹 Последняя модификация:', new Date(project.lastUpdate).toLocaleString());
    console.log('🔹 Владелец:', project.owner);
    
    // Настройки проекта
    console.group('⚙️ Настройки проекта');
    console.log('Тема:', project.settings.theme);
    console.log('Режим отображения:', project.settings.defaultView);
    console.log('Уведомления:', project.settings.notifications ? 'Включены' : 'Выключены');
    console.groupEnd();
    
    // Файлы проекта
    if (project.files && project.files.length > 0) {
        console.group('📂 Файлы проекта (всего: %d)', project.files.length);
        
        project.files.forEach((file, index) => {
            console.groupCollapsed(`Файл #${index + 1}: ${file.filename}`);
            console.log('ID:', file.id);
            console.log('Матрица:', file.matrix ? '✅ Есть' : '❌ Нет');
            console.log('Размеры:', 
                file.width && file.height 
                    ? `${file.width}×${file.height} px` 
                    : 'Не определены');
            console.log('DPI:', file.dpi || 'Не указано');
            console.log('Автомасштабирование:', file.autoscale ? 'Включено' : 'Выключено');
            console.log('Колormap:', file.colormap || 'Не задана');
            console.log('История изменений (последние 3 шага):', 
                file.history.slice(-3).join(' → '));
            console.log('Текущий индекс истории:', file.historyIndex + 1);
            console.log('Выделенные области:', file.selection.length || 'Нет');
            console.groupEnd();
        });
        
        console.groupEnd();
    } else {
        console.log('📂 Файлы проекта: отсутствуют');
    }
    
    console.groupEnd(); // Закрываем группу проекта
}
async function saveProjectToMinIO123(project) {
    try {
        const API_BASE_URL = window.location.origin;
       

        // Глубокая копия с исключением canvas и ctx
        const cleanedProject = JSON.parse(JSON.stringify(project));
        delete cleanedProject.files[0].canvas;
        delete cleanedProject.files[0].ctx;

        delete cleanedProject.files[0].history[0].canvas;
        delete cleanedProject.files[0].history[0].ctx;

        console.log(cleanedProject);
        console.log(project);
        const res = await fetch(
            `${API_BASE_URL}/save_project`, 
            { 
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({  project: cleanedProject }) 
                // body: JSON.stringify({ project }) 
            });
        const data = await res.json();
        return data.success;
    } catch(e) { return false; }
}
async function saveProjectToMinIO_l() {
    const saved = await saveProjectToMinIO123(project);
}

/**
 * Преобразует объект проекта в JSON-строку с форматированием
 * @param {Project} project - объект проекта для сериализации
 * @param {number} [space=2] - количество пробелов для отступов (по умолчанию 2)
 * @returns {string} JSON-строка с информацией о проекте
*/
function projectToJson(project, space = 2) {
    if (!project || !(project instanceof Project)) {
        throw new Error('Ошибка: передан некорректный объект проекта');
    }

    // Создаем копию объекта, чтобы не изменять оригинал
    const projectCopy = { ...project };

    // Форматируем даты в удобочитаемый вид
    if (projectCopy.createdAt) {
        projectCopy.createdAt = new Date(projectCopy.createdAt).toISOString();
    }
    if (projectCopy.lastUpdate) {
        projectCopy.lastUpdate = new Date(projectCopy.lastUpdate).toISOString();
    }

    // Обрабатываем файлы проекта
    if (projectCopy.files && Array.isArray(projectCopy.files)) {
        projectCopy.files = projectCopy.files.map(file => {
            const fileCopy = { ...file };
            
            // Форматируем историю изменений
            if (fileCopy.history && Array.isArray(fileCopy.history)) {
                fileCopy.history = fileCopy.history.slice(-3); // Оставляем только последние 3 шага
            }
            
            // Обрабатываем выделенные области (если это массив объектов)
            if (fileCopy.selection && Array.isArray(fileCopy.selection)) {
                fileCopy.selection = fileCopy.selection.map(area => {
                    if (typeof area === 'object' && area !== null) {
                        return { ...area }; // Глубокая копия объектов областей
                    }
                    return area;
                });
            }
            
            return fileCopy;
        });
    }

    // Сериализуем в JSON с отступами
    return JSON.stringify(projectCopy, (key, value) => {
        // Обрабатываем специальные случаи (например, null или undefined)
        if (value === null || value === undefined) {
            return 'Не определено';
        }
        return value;
    }, space);
}

function createProjectFromData(projectData) {
    if (!projectData || typeof projectData !== 'object') {
        throw new Error('projectData должен быть объектом');
    }

    // Базовые свойства проекта
    const project = {
        id: projectData.project.id,
        name: projectData.project.name,
        type: projectData.project.type,
        createdAt: projectData.project.createdAt,
        lastUpdate: projectData.project.lastUpdate,
        owner: projectData.project.owner,
        settings: {
            theme: projectData.project.settings?.theme || 'light',
            defaultView: projectData.project.settings?.defaultView || 'list',
            notifications: projectData.project.settings?.notifications || false
        },
        files: []
    };

    // Восстанавливаем файлы (если есть)
    if (projectData.project.files && Array.isArray(projectData.project.files)) {
        projectData.project.files.forEach(fileData => {
            const file = {
                id: fileData.id,
                filename: fileData.filename || 'UnownName',
                matrix: fileData.matrix || null,
                minValue: fileData.minValue || null,
                maxValue: fileData.maxValue || null,
                height: fileData.height || null,
                width: fileData.width || null,
                dpi: fileData.dpi || null,
                autoscale: fileData.autoscale || true,
                colormap: fileData.colormap || null,
                // canvas: null, // canvas не сериализуется
                // ctx: null,     // ctx не сериализуется
                history: fileData.history || [],
                historyIndex: fileData.historyIndex || -1,
                selection: fileData.selection || []
            };
            

            // Создаем canvas элемент
            const cnv = document.createElement('canvas');
            cnv.className = 'paint-canvas';
            cnv.id = `canvas-${file.id}`;
            cnv.width = file.width;
            cnv.height = file.height;
            cnv.style.display = 'none';

            attachCanvasEvents(cnv);
            document.getElementById('canvasHost').appendChild(cnv);

            const colorBarNames = {
                'color-bar-gray': 'gray',
                'color-bar-plasma': 'plasma',
                'color-bar-inferno': 'inferno',
                'color-bar-magma': 'magma',
                'color-bar-cividis': 'cividis',
                'color-bar-rainbow': 'rainbow',
                'color-bar-coolwarm': 'coolwarm'       
            };
            const colorBar = document.getElementById('colorBar');
            const colormap = colorBarNames[colorBar.classList[1]];
            //console.log(colormap);
            const colorMap = getColormap(colormap);
            const data = new Uint8ClampedArray(file.width * file.height * 4);
            let dataIndex = 0;
            for (let y = 0; y < file.height; y++) {
                for (let x = 0; x < file.width; x++) {
                    const normalizedValue = (file.matrix[y][x] - file.minValue) / (file.maxValue - file.minValue + 1e-9) ;
                    
                    const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
                    // data[dataIndex++] = color.r * 255;
                    // data[dataIndex++] = color.g * 255;
                    // data[dataIndex++] = color.b * 255;
                    data[dataIndex++] = color.r;
                    data[dataIndex++] = color.g;
                    data[dataIndex++] = color.b;
                    data[dataIndex++] = 255;
                }
            }
            file.canvas = cnv;
            file.canvas = cnv.getContext('2d', { willReadFrequently: true });
            const imageData = new ImageData(data, file.width, file.height);
            file.ctx.putImageData(imageData, 0, 0);

            project.files.push(file);

        });
    }

    return project;
}


// const userData = {
//     username: 'test_user_tis',
//     settings: { theme: 'dark', lang: 'ru' },
//     created: new Date(),
//     permissions: ['read', 'write']
// };
// AppDB.add(userData);

// const AppDB = {
//     dbName: RECENT_FILES_KEY,
//     dbVersion: 1,
//     storeName: 'files',
//     db: null,

//     init() {
//         return new Promise((resolve, reject) => {
//             if (this.db) return resolve(this.db);

//             const request = indexedDB.open(this.dbName, this.dbVersion);

//             request.onupgradeneeded = (event) => {
//                 const db = event.target.result;
//                 if (!db.objectStoreNames.contains(this.storeName)) {
//                     const objectStore = db.createObjectStore(this.storeName, { 
//                         keyPath: 'id', 
//                         autoIncrement: true 
//                     });
//                     objectStore.createIndex('username', 'username', { unique: false  });
//                 }
//             };

//             request.onsuccess = (event) => {
//                 this.db = event.target.result;
//                 resolve(this.db);
//             };
//             request.onerror = (event) => reject(event.target.errorCode);
//         });
//     },

//     async add(data) {
//         await this.init();
//         return new Promise((resolve, reject) => {

//             const transaction = this.db.transaction([this.storeName], 'readwrite');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.put(data);
//             console.log(data);
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });
//     },

//     async get(id) {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readonly');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.get(id);
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });
//     },

//     async getAll() {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readonly');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.getAll();
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });
//     },

//     async clear() {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readwrite');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.clear();
//             request.onsuccess = () => resolve();
//             request.onerror = () => reject(request.error);
//         });
//     }
// };



// Создание экземпляра project с тестовыми данными
project ={
    id: 42,
    type: 'Графический редактор',
    owner: 'Анна Иванова',
    settings: {
        theme: 'dark',
        defaultView: 'grid',
        notifications: true
    },
    files: [
        {
            id: 101,
            filename: 'canvas_main.png',
            matrix: { data: new Uint8Array(100) }, // имитация матрицы пикселей
            width: 1920,
            height: 1080,
            dpi: 300,
            autoscale: true,
            colormap: 'sRGB',
            history: ['заливка', 'кисть', 'фильтр', 'кадрирование'],
            historyIndex: 2,   // последний шаг — 'фильтр'
            selection: [{ x: 10, y: 10, w: 50, h: 50 }]
        },
        {
            id: 102,
            filename: 'icon.svg',
            matrix: null,   // нет матрицы для векторного файла
            width: 64,
            height: 64,
            dpi: 72,
            autoscale: false,
            colormap: null,
            history: ['создание контура', 'заливка'],
            historyIndex: 1,
            selection: []
        }
    ]
};

// Теперь можно вызвать logProject(project);
// logProject(project);