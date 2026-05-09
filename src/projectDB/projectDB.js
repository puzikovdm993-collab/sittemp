// ============ Модуль работы с IndexedDB для кэширования проектов ============
// Схема: minio <=> indexeddb <=> браузер клиента

const ProjectDB = {
    DB_NAME: 'WTIS_Projects_DB',
    DB_VERSION: 1,
    STORE_NAME: 'projects',
    
    db: null,
    // Флаг для предотвращения рекурсивной синхронизации
    isSyncingToMinIO: false,

    // Инициализация базы данных
    async init() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('❌ Ошибка открытия IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB успешно инициализирована:', this.DB_NAME);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилище для проектов, если его нет
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId', { unique: true });
                    store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    console.log('📦 Хранилище projects создано');
                }
            };
        });
    },

    // Сохранение проекта в IndexedDB
    async saveProject(projectData, skipLog = false) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                
                // Нормализуем структуру проекта, убирая дублирующиеся поля
                let normalizedProject = { ...projectData };
                
                // Если есть вложенный объект project, извлекаем данные из него
                if (normalizedProject.project && typeof normalizedProject.project === 'object') {
                    const innerProject = normalizedProject.project;
                    
                    // Копируем поля из вложенного project только если их нет на верхнем уровне
                    if (!normalizedProject.id && innerProject.id) {
                        normalizedProject.id = innerProject.id;
                    }
                    if (!normalizedProject.name && innerProject.name) {
                        normalizedProject.name = innerProject.name;
                    }
                    if (!normalizedProject.createdAt && innerProject.createdAt) {
                        normalizedProject.createdAt = innerProject.createdAt;
                    }
                    if (!normalizedProject.lastUpdate && innerProject.lastUpdate) {
                        normalizedProject.lastUpdate = innerProject.lastUpdate;
                    }
                    if (!normalizedProject.owner && innerProject.owner !== undefined) {
                        normalizedProject.owner = innerProject.owner;
                    }
                    if (!normalizedProject.type && innerProject.type) {
                        normalizedProject.type = innerProject.type;
                    }
                    if (!normalizedProject.order && innerProject.order !== undefined) {
                        normalizedProject.order = innerProject.order;
                    }
                    // Объединяем settings, отдавая приоритет верхнему уровню
                    if (innerProject.settings) {
                        normalizedProject.settings = {
                            ...innerProject.settings,
                            ...(normalizedProject.settings || {})
                        };
                    }
                    
                    // Удаляем вложенный объект project чтобы избежать дублирования
                    delete normalizedProject.project;
                }
                
                // Убеждаемся, что у проекта есть поле id для keyPath
                if (!normalizedProject.id) {
                    console.warn('⚠️ У проекта отсутствует поле id, используем projectId из метаданных или генерируем');
                    normalizedProject.id = normalizedProject.projectId || normalizedProject._id || `unknown_${Date.now()}`;
                }
                
                // Сохраняем проект без лишних служебных полей и с историей файлов
                const projectToSave = { ...normalizedProject };
                
                // Добавляем информацию об открытых файлах и их истории
                if (window.project && window.project.files) {
                    projectToSave.openedFiles = window.project.files.map(file => ({
                        id: file.id,
                        filename: file.filename,
                        width: file.width,
                        height: file.height,
                        dpi: file.dpi,
                        minValue: file.minValue,
                        maxValue: file.maxValue,
                        autoscale: file.autoscale,
                        colormap: file.colormap,
                        matrix: file.matrix,
                        history: file.history || [],
                        historyIndex: file.historyIndex || -1
                    }));
                    projectToSave.activeFileId = window.activeFileId;
                }
                
                const request = store.put(projectToSave);

                request.onsuccess = () => {
                    if (!skipLog) {
                        console.log('💾 Проект сохранён в IndexedDB:', normalizedProject.id);
                    }
                    resolve(projectToSave);
                };

                request.onerror = () => {
                    console.error('❌ Ошибка сохранения в IndexedDB:', request.error);
                    reject(request.error);
                };

                transaction.oncomplete = () => {
                    if (!skipLog) {
                        console.log('✅ Транзакция записи завершена');
                    }
                };

                transaction.onerror = () => {
                    console.error('❌ Ошибка транзакции:', transaction.error);
                };
            } catch (error) {
                console.error('❌ Исключение при сохранении в IndexedDB:', error);
                reject(error);
            }
        });
    },

    // Сохранение состояния проекта (открытые файлы, история) в IndexedDB
    async saveProjectState(projectId) {
        try {
            if (!this.db) {
                await this.init();
            }
            
            // Получаем текущий проект из IndexedDB
            const cachedProject = await this.getProject(projectId);
            if (!cachedProject) {
                console.warn('⚠️ Проект не найден в IndexedDB для обновления состояния:', projectId);
                return;
            }
            
            // Обновляем состояние и сохраняем
            await this.saveProject(cachedProject, true);
            console.log(`🔄 Состояние проекта ${projectId} обновлено в IndexedDB`);
            
            // Асинхронно синхронизируем с MinIO
            this.syncStateToMinIO(projectId).catch(err => {
                console.error('❌ Ошибка фоновой синхронизации с MinIO:', err);
            });
        } catch (error) {
            console.error('❌ Ошибка сохранения состояния проекта:', error);
        }
    },

    // Синхронизация состояния с MinIO (асинхронно)
    async syncStateToMinIO(projectId) {
        if (this.isSyncingToMinIO) {
            console.log('⏳ Синхронизация с MinIO уже выполняется, пропускаем');
            return;
        }

        try {
            this.isSyncingToMinIO = true;
            console.log(`📤 Начало синхронизации проекта ${projectId} в MinIO...`);
            
            // Получаем актуальные данные из IndexedDB
            const projectData = await this.getProject(projectId);
            if (!projectData) {
                throw new Error('Проект не найден в IndexedDB');
            }
            
            // Отправляем данные на сервер для сохранения в MinIO
            const apiBaseUrl = window.apiBaseUrl || '';
            const response = await fetch(`${apiBaseUrl}/save_project/${projectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`✅ Проект ${projectId} синхронизирован: IndexedDB -> MinIO`);
            return result;
        } catch (error) {
            console.error(`❌ Ошибка синхронизации проекта ${projectId} с MinIO:`, error);
            throw error;
        } finally {
            this.isSyncingToMinIO = false;
        }
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
                        console.log('📥 Проект загружен из IndexedDB:', projectId);
                        resolve(request.result);
                    } else {
                        console.log('⚠️ Проект не найден в IndexedDB:', projectId);
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    console.error('❌ Ошибка загрузки из IndexedDB:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ Исключение при загрузке из IndexedDB:', error);
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
                    console.log('📚 Загружено проектов из кэша:', request.result.length);
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('❌ Ошибка получения всех проектов:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ Исключение при получении всех проектов:', error);
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
                    console.log('🗑️ Проект удалён из IndexedDB:', projectId);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ Ошибка удаления из IndexedDB:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ Исключение при удалении проекта:', error);
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
                    console.log('🧹 Кэш очищен');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ Ошибка очистки кэша:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('❌ Исключение при очистке кэша:', error);
                reject(error);
            }
        });
    },

    // Синхронизация: загрузка из MinIO с последующим кэшированием
    async syncProjectFromMinIO(projectId, apiBaseUrl) {
        try {
            console.log(`🔄 Синхронизация проекта ${projectId} из MinIO...`);
            
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
            
            console.log(`✅ Проект ${projectId} синхронизирован: MinIO -> IndexedDB`);
            return projectData;
            
        } catch (error) {
            console.error(`❌ Ошибка синхронизации проекта ${projectId}:`, error);
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
                    console.log(`⚡ Используем закэшированную версию проекта ${projectId}`);
                    
                    // Асинхронно обновляем кэш из MinIO (фоновая синхронизация)
                    this.syncProjectFromMinIO(projectId, apiBaseUrl)
                        .then(freshData => {
                            console.log(`🔄 Фон: Проект ${projectId} обновлён в кэше`);
                        })
                        .catch(err => {
                            console.warn(`⚠️ Фон: Не удалось обновить проект ${projectId}:`, err);
                        });
                    
                    return cachedProject;
                }
            }
            
            // Если кэш пуст или не используем кэш - загружаем с сервера
            console.log(`📥 Загрузка проекта ${projectId} из MinIO...`);
            const projectData = await this.syncProjectFromMinIO(projectId, apiBaseUrl);
            
            return projectData;
            
        } catch (error) {
            console.error(`❌ Критическая ошибка загрузки проекта ${projectId}:`, error);
            throw error;
        }
    }
};

// Экспорт для использования в других модулях
window.ProjectDB = ProjectDB;
