// ============ Модуль работы с IndexedDB для кэширования проектов ============
// Схема: minio <=> indexeddb <=> браузер клиента

const ProjectDB = {
    DB_NAME: 'WTIS_Projects_DB',
    DB_VERSION: 1,
    STORE_NAME: 'projects',
    
    db: null,

    // Инициализация базы данных
    async init() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('Ошибка открытия IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB успешно инициализирована:', this.DB_NAME);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилище для проектов, если его нет
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId', { unique: true });
                    store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    console.log('Хранилище projects создано');
                }
            };
        });
    },

    // Сохранение проекта в IndexedDB
    async saveProject(projectData) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                
                // Добавляем метку времени обновления
                const projectWithTimestamp = {
                    ...projectData,
                    lastUpdated: Date.now(),
                    cachedAt: new Date().toISOString()
                };

                const request = store.put(projectWithTimestamp);

                request.onsuccess = () => {
                    console.log('Проект сохранён в IndexedDB:', projectData.id);
                    resolve(projectWithTimestamp);
                };

                request.onerror = () => {
                    console.error('Ошибка сохранения в IndexedDB:', request.error);
                    reject(request.error);
                };

                transaction.oncomplete = () => {
                    console.log('Транзакция записи завершена');
                };

                transaction.onerror = () => {
                    console.error('Ошибка транзакции:', transaction.error);
                };
            } catch (error) {
                console.error('Исключение при сохранении в IndexedDB:', error);
                reject(error);
            }
        });
    },

    // Загрузка проекта из IndexedDB
    async getProject(projectId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.get(projectId);

                request.onsuccess = () => {
                    if (request.result) {
                        console.log('Проект загружен из IndexedDB:', projectId);
                        resolve(request.result);
                    } else {
                        console.log('Проект не найден в IndexedDB:', projectId);
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error('Ошибка загрузки из IndexedDB:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Исключение при загрузке из IndexedDB:', error);
                reject(error);
            }
        });
    },

    // Проверка наличия проекта в кэше
    async hasProject(projectId) {
        const project = await this.getProject(projectId);
        return project !== null;
    },

    // Получение всех закэшированных проектов
    async getAllProjects() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.getAll();

                request.onsuccess = () => {
                    console.log('Загружено проектов из кэша:', request.result.length);
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('Ошибка получения всех проектов:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Исключение при получении всех проектов:', error);
                reject(error);
            }
        });
    },

    // Удаление проекта из IndexedDB
    async deleteProject(projectId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.delete(projectId);

                request.onsuccess = () => {
                    console.log('Проект удалён из IndexedDB:', projectId);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('Ошибка удаления из IndexedDB:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Исключение при удалении проекта:', error);
                reject(error);
            }
        });
    },

    // Очистка всего кэша
    async clearCache() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('Кэш очищен');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('Ошибка очистки кэша:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Исключение при очистке кэша:', error);
                reject(error);
            }
        });
    },

    // Синхронизация: загрузка из MinIO с последующим кэшированием
    async syncProjectFromMinIO(projectId, apiBaseUrl) {
        try {
            console.log(`Синхронизация проекта ${projectId} из MinIO...`);
            
            // Загружаем проект с сервера (MinIO)
            const response = await fetch(`${apiBaseUrl}/load_project/${projectId}`);
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            const projectData = result.data;
            
            if (!projectData) {
                throw new Error('Пустые данные проекта от сервера');
            }
            
            // Кэшируем в IndexedDB
            await this.saveProject(projectData);
            
            console.log(`Проект ${projectId} синхронизирован: MinIO -> IndexedDB`);
            return projectData;
            
        } catch (error) {
            console.error(`Ошибка синхронизации проекта ${projectId}:`, error);
            throw error;
        }
    },

    // Умная загрузка: сначала пробуем кэш, затем сервер
    async loadProjectWithCache(projectId, apiBaseUrl, useCacheFirst = true) {
        try {
            // Инициализируем базу данных
            await this.init();
            
            if (useCacheFirst) {
                // Пробуем загрузить из кэша
                const cachedProject = await this.getProject(projectId);
                
                if (cachedProject) {
                    console.log(`Используем закэшированную версию проекта ${projectId}`);
                    
                    // Асинхронно обновляем кэш из MinIO (фоновая синхронизация)
                    this.syncProjectFromMinIO(projectId, apiBaseUrl)
                        .then(freshData => {
                            console.log(`Фон: Проект ${projectId} обновлён в кэше`);
                        })
                        .catch(err => {
                            console.warn(`Фон: Не удалось обновить проект ${projectId}:`, err);
                        });
                    
                    return cachedProject;
                }
            }
            
            // Если кэш пуст или не используем кэш - загружаем с сервера
            console.log(`Загрузка проекта ${projectId} из MinIO...`);
            const projectData = await this.syncProjectFromMinIO(projectId, apiBaseUrl);
            
            return projectData;
            
        } catch (error) {
            console.error(`Критическая ошибка загрузки проекта ${projectId}:`, error);
            throw error;
        }
    }
};

// Экспорт для использования в других модулях
window.ProjectDB = ProjectDB;
