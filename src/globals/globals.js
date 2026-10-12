// Глобальные переменные (настройки и состояние приложения)

const radialMenuConfig = {
    MAX_MENU_ITEMS:8,
    enabled: true,
    radius: 90,
    items: [

        // Инструменты
        { id: 'undo',       group: 'tools', icon: 'icon-undo',          label: 'Отменить',  action: 'undo',     enabled: false },
        { id: 'redo',       group: 'tools', icon: 'icon-redo',          label: 'Повторить', action: 'redo',     enabled: false },
        { id: 'zoom-in',    group: 'tools', icon: 'icon-zoom-in',       label: 'Увеличить', action: 'zoomIn',   enabled: false },
        { id: 'zoom-out',   group: 'tools', icon: 'icon-zoom-out',      label: 'Уменьшить', action: 'zoomOut',  enabled: false },
        { id: 'rotate',     group: 'tools', icon: 'icon-rotate-right',  label: 'Повернуть', action: 'rotate',   enabled: false },
        { id: 'profile',    group: 'tools', icon: 'CurvesEffectIcon',   label: 'Профиль',   action: 'profiles', enabled: false },
        { id: 'history',    group: 'tools', icon: 'icon-history',       label: 'История',   action: 'history',  enabled: false },

        // Фильтры
        { id: 'sobel',          group: 'filters',   icon: 'SobelEffectPluginIcon',          label: 'Edge фильтр',           action: 'sobel',            enabled: false },
        { id: 'median',         group: 'filters',   icon: 'MedianEffectPluginIcon',         label: 'Медианный',             action: 'median',           enabled: false },
        { id: 'approximation',  group: 'filters',   icon: 'ApproximationEffectPluginIcon',  label: 'Аппроксимация',         action: 'approximation',    enabled: false },
        { id: 'logarithm',      group: 'filters',   icon: 'PrelimProcessIcon',              label: 'Предобработка',         action: 'logarithm',        enabled: false },
        { id: 'contour',        group: 'filters',   icon: 'KONTUREffectPluginIcon',         label: 'Контур',                action: 'contour',          enabled: false },
        { id: 'edge-detect',    group: 'filters',   icon: 'EdgeDetectEffectIcon',           label: 'Определение границ',    action: 'edgeDetect',       enabled: false },
        { id: 'normalization',  group: 'filters',   icon: 'NormalizEffectPluginIcon',       label: 'Нормализация',          action: 'normalization',    enabled: false },
        { id: 'round-search',   group: 'filters',   icon: 'RoundSearchingIcon',             label: 'Поиск окружности',      action: 'roundSearch',      enabled: false }
    ],
    
    // Инициализация результирующих массивов
    defaultTools: [],
    defaultFilters: [],
    defaultOther: []
};



let currentTool = 'cursor';       // Текущий инструмент (по умолчанию — текст)
let isDrawing = false;          // Флаг, указывающий, ведётся ли рисование
let startX = 0, startY = 0;     // Начальные координаты рисунка (X и Y)
let lastX = 0, lastY = 0;       // Последние координаты курсора для плавного рисования
let zoom = 1;                   // Коэффициент масштабирования холста
let activeFileId = null;        // ID активного файла (для работы с несколькими файлами)
let canvas = null;              // Ссылка на HTML-элемент холста
let ctx = null;                 // Ссылка на контекст рисования холста (2D)

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
let selectedPoint = null;               // Выбранная точка профиля ('start', 'end' или null)

// DOM-элементы (заполняются в main.js)
let dom = {};

// Константы
const maxHistory = 20;  // Максимальное количество шагов в истории (undo/redo)
// const RECENT_FILES_KEY = 'tis_recent_files';// Ключ для хранения в IndexedDB списка недавних файлов
// const MAX_RECENT_FILES = 10;// Максимальное количество файлов в списке "Недавно открытые"



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
let project;

// ${CONFIG.API_BASE_URL}
const CONFIG = {
    // API_BASE_URL: 'http://127.0.0.1:15404',
    API_BASE_URL: 'http://dev.wtis.wfront.svk.sils.local',
    // API_BASE_URL: window.location.origin,
    API_ENDPOINTS: {
        PROJECT: '/api/v1/projects',
        MATRIX: '/api/v2/projects'
    },
    PLOTLY: {
        LINE_WIDTH: 2.2,
        Y_RANGE: [0, 255]
    }
};








let DBDBD = null;





function createDefaultProject() {
    return {
        id: 'proj_1782469150219_123123', // ID будет сгенерирован на сервере или клиентом позже
        name: 'Новый проект',
        type: 'default',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'pending',
        owner: 'current_user', // Заменить на реальное имя пользователя или ID
        settings: {
            theme: 'light',
            defaultView: 'list',
            notifications: false
        },
        files: []
    };
}

/**
 * Выводит объект проекта в консоль с форматированием
 * @param {Project} project - объект проекта для вывода
 */
function logProject(project) {
    if (!project ) {
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


/**
* Загружает и заполняет матрицы для всех файлов проекта.
*/
async function fillProjectMatrices(project) {
    const files = project.files;
        
    // Используем for...of для корректного ожидания await
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        
        // Проходим по истории, начиная со второго элемента (hisIndex > 0)
        for (let hisIndex = 0; hisIndex < file.history.length; hisIndex++) {
            const his = file.history[hisIndex];
            console.log(CONFIG.API_BASE_URL)
            console.log(CONFIG.API_ENDPOINTS.MATRIX)
            const endpoint = `${CONFIG.API_BASE_URL}/${CONFIG.API_ENDPOINTS.MATRIX}/?fullPath=${encodeURIComponent(his.matrix)}`;
            console.log(endpoint)

            try {
                const response_matrix = await fetch(endpoint, { 
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json' 
                    }
                });
                
                if (!response_matrix.ok) {
                    throw new Error(`Ошибка загрузки проекта: ${response_matrix.statusText}`);
                }
    
                // Получаем бинарные данные как Blob
                const blob = await response_matrix.blob();
                const text = await blob.text();
                
                // Парсинг данных
                const lines = text.split(',')
                    .map(val => parseFloat(val.trim()))
                    .filter(val => !isNaN(val));

                // Нарезка на строки
                const matrix = [];
                for (let i = 0; i < lines.length; i += his.w) {
                    matrix.push(lines.slice(i, i + his.w));
                }
                               
                // Обновляем историю
                his.matrix = matrix;
                // Обновляем текущий файл (если нужно хранить актуальную матрицу в файле)
                file.matrix = matrix;
    
            } catch (error) {
                console.error(`Ошибка при обработке файла ${fileIndex}, истории ${hisIndex}:`, error);
                // Решите, как обрабатывать ошибки: пропустить, прервать или записать ошибку
            }
        }
    }
}



async function loadProjectMetadata(projectId) {
    if (!projectId) return null;
    const localProject = await idb.get(DBDBD,STORE_NAME_PROJECT, projectId);
    return localProject;

    // try {
    //     const response = await fetch(url, {
    //         method: 'GET',
    //         headers: { 'Content-Type': 'application/json' }
    //     });
    //     if (!response.ok) {
    //         if (response.status === 404) {
    //             console.warn(`Проект с ID ${projectId} не найден.`);
    //             return null;
    //         }
    //         throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
    //     }
    //     const data = await response.json();
    //     return data.project;
    // } catch (error) {
    //     console.error('Ошибка загрузки метаданных проекта:', error);
    //     return null;
    // }
}














