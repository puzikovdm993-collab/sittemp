////////////////////////////////////////////////////////
////////////////////////// db //////////////////////////
////////////////////////////////////////////////////////

const DB_NAME = 'ProjectFilesDB';
const DB_VERSION = 1;
// const STORE_NAME_DIFF = 'diffproject';
const STORE_NAME_PROJECT = 'projects';

/**
 * Инициализация базы данных IndexedDB
 * Создает подключение к базе 'ProjectFilesDB' и
 *  создает необходимые хранилища, если они отсутствуют.
 * @returns {Promise<IDBDatabase>} Промис с объектом базы данных
 */
// Инициализация базы данных
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME_PROJECT)) {
                const store = db.createObjectStore(STORE_NAME_PROJECT, { keyPath: 'id' });
                store.createIndex('syncStatus', 'syncStatus', { unique: false });
            }
            // if (!db.objectStoreNames.contains(STORE_NAME_DIFF)) {
            //     db.createObjectStore(STORE_NAME_DIFF, { keyPath: 'id' });
            //     store.createIndex('syncStatus', 'syncStatus', { unique: false });
            // }
        };
        request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
        request.onerror = (e) => reject(e.target.error);
    });
}

// Универсальная функция для транзакций
async function performTx(db,storename, mode, callback) {

    if (!db || typeof db.transaction !== 'function') {
        throw new Error('Недопустимый объект базы данных, переданный в performTx');
    }
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(storename, mode);
            const store = tx.objectStore(storename);
            const request = callback(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        } catch (err) {
            reject(err);
        }
    });
}

const idb = {
           set: (db,storename, data) => performTx(db,storename, 'readwrite', store => store.put(data)),
        remove: (db,storename, data) => performTx(db,storename, 'readwrite', store => store.delete(data)),
           get: (db,storename, id) => performTx(db,storename, 'readonly', store => store.get(id)),
        getAll: (db,storename) => performTx(db,storename, 'readonly', store => store.getAll()),
    getPending: (db,storename) => performTx(db,storename, 'readonly', store => store.index('syncStatus').getAll('pending'))
};














async function setProject(projectData) {
    const project2 = { 
        ...projectData, 
        updatedAt: Date.now(), 
        syncStatus: 'pending' 
    };
    let tt = removeCanvasAndCtx(project2);



    // console.log(project2)
    // const cleanedData = removeCanvasAndCtx(project2);
    // console.log(cleanedData)



    setTimeout(async() => {
        await idb.set(DBDBD,STORE_NAME_PROJECT, tt);
    }, 1000);
    console.log(`Проект ${project2.id} сохранено локально (статус: ожидает синхронизацию)`);
}

async function getProject(projectID) {
    project = await idb.get(DBDBD, STORE_NAME_PROJECT, projectID);
    console.log(`Проект ${project.id} загружен из IndexeDB`);
}

async function deleteProject(projectID) {
    console.log(`Должна быть реализация удаления проекта`);
}






// Синхронизация: Local -> Remote (отправка всех pending проектов)
async function syncLocalToRemote(db) {
    const pendingProjects = await idb.getPending(db,STORE_NAME_PROJECT);
    if (!pendingProjects ||pendingProjects.length === 0) return;


    // if (navigator.onLine) {
        console.log(navigator.onLine)
    for (const project of pendingProjects) {
        try {
            await minio.uploadProject(project);
            
            // Обновляем статус на 'synced' после успешной загрузки
            project.syncStatus = 'synced';

            await idb.set(db, STORE_NAME_PROJECT,project);
            console.log(`Проект ${project.id} синхронизирован.`);
        } catch (e) {
            console.error(`Не удалось синхронизировать проект ${project.id}:`, e);
        }
    }
}

// Синхронизация: Remote -> Local (загрузка обновлений с сервера)
async function syncRemoteToLocal(db) {
    try {
        const remoteProjects = await minio.listProjects();
        if (!remoteProjects) return;

        for (const remoteInfo of remoteProjects) {

            const localProject = await idb.get(db, STORE_NAME_PROJECT, remoteInfo.id);

            // 1. Проверка: проект есть на удаленном, но нет в локальном
            const isNewProject = !localProject;
            
            // 2. Проверка: удаленная версия новее и локальная не в ожидании синхронизации
            const isUpdateNeeded = localProject && 
                                  remoteInfo.lastUpdate > localProject.lastUpdate && 
                                  localProject.syncStatus !== 'pending';

            if (isNewProject || isUpdateNeeded) {
                try {
                    const remoteData = await minio.loadProject(remoteInfo.id);
                    if (remoteData) {
                        remoteData.syncStatus = 'synced';
                    
                        setTimeout(async() => {
                            await idb.set(DBDBD,STORE_NAME_PROJECT, remoteData);
                        }, 500);
                    }
                } catch (e) {
                    console.error(`Не удалось загрузить проект ${remoteInfo.id}:`, e);
                }
            }
        }
    } catch (e) {
        console.error('Ошибка при удалённой синхронизации:', e);
    }
}
















/**
 * Рекурсивно удаляет свойства 'canvas' и 'ctx' из объекта, возвращая новый объект.
 * @param {Object} obj - Исходный объект
 * @returns {Object} - Новый объект без свойств 'canvas' и 'ctx'
 */
//  function removeCanvasAndCtx(obj) {
//     // Если объект не является объектом или null, возвращаем его как есть
//     if (obj === null || typeof obj !== 'object') {
//         return obj;
//     }

//     // Если это массив, рекурсивно обрабатываем каждый элемент
//     if (Array.isArray(obj)) {
//         return obj.map(item => removeCanvasAndCtx(item));
//     }

//     // Создаем новый объект, исключая поля canvas и ctx
//     const cleanedObj = {};
//     for (const key of Object.keys(obj)) {
//         if (key === 'canvas' || key === 'ctx') {
//             continue; // Пропускаем удаление полей
//         }
//         // Рекурсивно обрабатываем значение ключа
//         cleanedObj[key] = removeCanvasAndCtx(obj[key]);
//     }

//     return cleanedObj;
// }

/**
 * Безопасная очистка объекта:
 * 1. Не мутирует исходный объект.
 * 2. Удаляет 'canvas' и 'ctx'.
 * 3. Сохраняет общие ссылки (если один объект используется в разных местах).
 * 4. Предотвращает бесконечную рекурсию при циклических ссылках.
 */
 function removeCanvasAndCtx(obj, visited = new WeakMap()) {
    // Примитивы и null возвращаем как есть
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Если объект уже был скопирован, возвращаем его копию (сохранение ссылок)
    if (visited.has(obj)) {
        return visited.get(obj);
    }

    // Обработка массива
    if (Array.isArray(obj)) {
        const arrCopy = [];
        visited.set(obj, arrCopy); // Запоминаем ссылку на массив
        for (let i = 0; i < obj.length; i++) {
            arrCopy[i] = removeCanvasAndCtx(obj[i], visited);
        }
        return arrCopy;
    }

    // Обработка объекта
    const objCopy = {};
    visited.set(obj, objCopy); // Запоминаем ссылку на объект

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Пропускаем только canvas и ctx
            if (key === 'canvas' || key === 'ctx') {
                continue;
            }
            objCopy[key] = removeCanvasAndCtx(obj[key], visited);
        }
    }

    return objCopy;
}








 const minio = {
    // Отправка данных на сервер
    async uploadProject(project) {
        try {
            // // Запускаем таймер с уникальным именем
            // console.time('DatabaseSetOperation');

            // Сериализация в JSON строку
            let cleanedProject = removeCanvasAndCtx(project);


            // // Останавливаем таймер в любом случае
            // console.timeEnd('DatabaseSetOperation');


            const response = await fetch(`/api/data/upload/${project.id}`, { 
                method: 'POST', 
                headers: {
                    'Content-Type':'application/json'
                }, 
                body: JSON.stringify({ project:cleanedProject }) 
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Ошибка сервера');
            }
        } catch (error) {
            console.log(`Ошибка при отправке: ${error.message}`, 'error');
        } finally {

        }
    },

    // Получение данных с сервера
    async loadProject(projectId) {
        try {
            const response = await fetch(`/api/data/upload/${projectId}`, {
                 method: 'GET'
            });

            if (!response.ok) throw new Error();
            const data = await response.json();
            
            if (data.status == "success") {
                const project = data.project.project;
                return project;
            }
            else{ 
                console.log("nulls");
                return null;
            }

        } catch (error) {
            console.log(`Ошибка: ${error.message}`, 'error');
        } finally {

        }
    },

    // Получение списка проектов
    async listProjects() {
        const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINTS.PROJECT}`, { method: 'GET' });

        if (!res.ok) throw new Error();
        const data = await res.json();


        if (data.success && Array.isArray(data.projects)) {
            const projects_lo = data.projects;
            
            // for (let i = 0; i < projects_lo.length; i++) {
            //     if (projects_lo[i].order === undefined || projects_lo[i].order === null) projects_lo[i].order = i;
            // }
            // updateAuthorFilter();
            // updateTypeFilter();
            projects_lo.sort((a,b) => (a.order || 0) - (b.order || 0));
            return projects_lo;
        }
    }
};








/**
 * Дополнительно: обработка возвращения сети
 * Если пользователь был offline и интернет появился, запускаем синхронизацию в фоне
 */
 window.addEventListener('online', async () => {
    console.log("🌐 Сеть восстановлена. Запуск фоновой синхронизации..."); 
    await syncRemoteToLocal(DBDBD);
    console.log("Синхронизация прошла успешно.");
});



















////////////////////////////////////////////////////////
///////////////// Состояние приложения /////////////////
////////////////////////////////////////////////////////

let state = {
    timerId: null,
    lastActivity: Date.now(),
    isSaving: false,
    hasChanges: false,
    pendingData: null,
    isSyncing: false,
    sizeTimer: 5000
};

/**
 * Инициализация отслеживания активности пользователя
 * Добавляет слушатели событий, которые считаются признаком "жизни" пользователя.
 * При каждом событии запускается (или перезапускается) таймер до синхронизации.
 */
function initializeActivityTracking() {
    // События, которые считаются активностью пользователя
    const activityEvents = [
        'mouseup',
        'keypress',
        'scroll',
        'touchstart',
        'input',
        'change'
    ];
    // Добавляем обработчики событий
    // { capture: true } ловит события на ранней стадии всплытия
    // { passive: true } улучшает производительность прокрутки
    activityEvents.forEach(event => {
        document.addEventListener(event, onUserActivity, { passive: true, capture: true });
    });
    console.log('Отслеживание активности запущено');
}





/**
 * Обработчик активности пользователя
 */
 async function onUserActivity() {
    if (state.isSyncing) return; // Защита от рекурсии/наложения
    try {
        const pendingProjects = await idb.getPending(DBDBD,STORE_NAME_PROJECT);
        if (pendingProjects.length === 0) {
            console.log('Нет данных для синхронизации.')
            return; 
        }

        // Сбрасываем предыдущий таймер
        if (state.timerId) {
            console.log('clearTimeout');
            clearTimeout(state.timerId);
        }
        
        // Запускаем новый таймер
        state.timerId = setTimeout(() => {
            state.timerId = null; // Сбрасываем ID таймера
            state.isSyncing = true;
            console.log('Периодическая  попытка синхронизации...');
            syncLocalToRemote(DBDBD).catch(err => console.error('Background sync error:', err));
            state.isSyncing = false;
        }, state.sizeTimer);
        

    } catch (error) {
        console.error('Ошибка обаработчика активности пользователя:', error);
    } finally {

    }
}


  

/**
 * Упаковывает объект file в бинарный формат для передачи.
 * @param {Object} projectId - ID проекта.
 * @param {Object} file - Объект с метаданными и матрицей.
 * @returns {Object} - { metadata }
 */
function serializeFileToBinary(projectId, file) {
    const history = file.history[file.historyIndex];
    const matrixBlob = new Blob([history.matrix], { type: 'application/octet-stream' });
    const metadata = {
        projectId:      projectId,
        fileId:         file.id,
        historyIndex:   file.historyIndex,
        history:        history
    };
    metadata.history.matrixBin = matrixBlob;
    metadata.history.matrix = null;
    metadata.history.ctx = null;
    return metadata;
}

/**
 * Основная функция сохранения и подготовки к отправке
 * 1. Сериализует данные файла в бинарный формат.
 * 2. Сохраняет результат в IndexedDB (кэширование).
 * @param {number} projectId - ID проекта
 * @param {Object} file - Объект файла с данными и историей
 */
async function uploadFileToServerWithCache(projectId, file) {
    try {
        // Преобразуем объект в формат, удобный для отправки и хранения
        const metadata = serializeFileToBinary(projectId, file);
        // console.log(metadata)

        // Убедимся, что БД инициализирована
        const db = await initDB(DB_NAME,DB_VERSION, STORE_NAME); 
        await saveToDB(db,STORE_NAME, metadata);
        //console.log('Данные сохранены в IndexedDB');
    } catch (error) {
        console.error('Не удалось сохранить в IndexedDB:', error);
    }
}





