// ============ Работа с IndexedDB для кэширования проектов WTIS ============
// Схема: MinIO <=> IndexedDB <=> Приложение

const ProjectDB = {
    dbName: 'wtis_projects_cache',
    dbVersion: 1,
    storeName: 'projects',
    db: null,

    /**
     * Инициализация базы данных IndexedDB
     * @returns {Promise<IDBDatabase>} База данных
     */
    init() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);

            const request = indexedDB.open(this.dbName, this.dbVersion);

            // Создание структуры БД при первом открытии или обновлении версии
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилище проектов, если его нет
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { 
                        keyPath: 'projectId' 
                    });
                    
                    // Индексы для быстрого поиска
                    objectStore.createIndex('name', 'name', { unique: false });
                    objectStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
                    objectStore.createIndex('owner', 'owner', { unique: false });
                }
            };

            // Успешное открытие БД
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ ProjectDB инициализирован');
                resolve(this.db);
            };

            // Ошибка открытия БД
            request.onerror = (event) => {
                console.error('❌ Ошибка инициализации ProjectDB:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    },

    /**
     * Сохранение проекта в IndexedDB (кэширование после загрузки из MinIO)
     * @param {string} projectId - ID проекта
     * @param {object} projectData - Данные проекта
     * @returns {Promise<number>} ID транзакции
     */
    async saveProject(projectId, projectData) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const record = {
                    projectId: projectId,
                    data: projectData,
                    cachedAt: new Date().toISOString(),
                    name: projectData.project?.name || 'Без названия',
                    lastUpdate: projectData.project?.lastUpdate || Date.now(),
                    owner: projectData.project?.owner || 'unknown'
                };
                
                const request = store.put(record);
                
                request.onsuccess = () => {
                    console.log(`💾 Проект ${projectId} сохранён в IndexedDB`);
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    console.error('Ошибка сохранения проекта в IndexedDB:', request.error);
                    reject(request.error);
                };
                
                transaction.oncomplete = () => {
                    console.log(`✅ Транзакция сохранения проекта ${projectId} завершена`);
                };
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Загрузка проекта из IndexedDB (кэш)
     * @param {string} projectId - ID проекта
     * @returns {Promise<object|null>} Данные проекта или null, если не найден
     */
    async getProject(projectId) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(projectId);
            
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log(`📦 Проект ${projectId} загружен из IndexedDB (кэш)`);
                    resolve(result.data);
                } else {
                    console.log(`⚠️ Проект ${projectId} не найден в IndexedDB`);
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('Ошибка загрузки проекта из IndexedDB:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * Проверка наличия проекта в кэше и его актуальности
     * @param {string} projectId - ID проекта
     * @param {number} serverTimestamp - Время последней модификации на сервере
     * @returns {Promise<boolean>} true, если кэш актуален
     */
    async isCacheValid(projectId, serverTimestamp) {
        const cached = await this.getProject(projectId);
        
        if (!cached) return false;
        
        const cacheTime = new Date(cached.project?.lastUpdate || 0).getTime();
        const serverTime = new Date(serverTimestamp).getTime();
        
        // Кэш актуален, если время совпадает
        return cacheTime >= serverTime;
    },

    /**
     * Удаление проекта из кэша
     * @param {string} projectId - ID проекта
     * @returns {Promise<void>}
     */
    async deleteProject(projectId) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(projectId);
            
            request.onsuccess = () => {
                console.log(`🗑️ Проект ${projectId} удалён из IndexedDB`);
                resolve();
            };
            
            request.onerror = () => {
                console.error('Ошибка удаления проекта из IndexedDB:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * Получение списка всех закэшированных проектов
     * @returns {Promise<Array>} Массив записей о проектах
     */
    async getAllProjects() {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                console.log(`📋 Загружено ${request.result.length} проектов из IndexedDB`);
                resolve(request.result || []);
            };
            
            request.onerror = () => {
                console.error('Ошибка получения списка проектов из IndexedDB:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * Очистка всего кэша проектов
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('🧹 Кэш проектов полностью очищен');
                resolve();
            };
            
            request.onerror = () => {
                console.error('Ошибка очистки кэша:', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * Синхронизация проекта: попытка загрузки из кэша, при неудаче или устаревании - загрузка из MinIO
     * @param {string} projectId - ID проекта
     * @param {Function} fetchFromServer - Функция для загрузки с сервера (MinIO)
     * @returns {Promise<object>} Данные проекта
     */
    async syncProject(projectId, fetchFromServer) {
        console.log(`🔄 Начало синхронизации проекта ${projectId}...`);
        
        try {
            // Шаг 1: Попытка загрузки из IndexedDB
            let projectData = await this.getProject(projectId);
            
            if (projectData) {
                console.log(`✅ Проект загружен из IndexedDB (быстрый старт)`);
                // Можно добавить проверку актуальности здесь
                return projectData;
            }
            
            // Шаг 2: Если нет в кэше, загружаем из MinIO
            console.log(`⬇️ Кэш не найден, загрузка из MinIO...`);
            projectData = await fetchFromServer(projectId);
            
            // Шаг 3: Сохраняем в IndexedDB для будущих загрузок
            await this.saveProject(projectId, projectData);
            console.log(`✅ Проект загружен из MinIO и сохранён в IndexedDB`);
            
            return projectData;
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации проекта:', error);
            
            // Пробуем ещё раз загрузить из кэша даже при ошибке (резервный вариант)
            const cached = await this.getProject(projectId);
            if (cached) {
                console.warn('⚠️ Использована устаревшая версия из кэша из-за ошибки сети');
                return cached;
            }
            
            throw error;
        }
    }
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectDB;
}
