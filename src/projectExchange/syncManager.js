// ============ Project Sync Manager ============
// Синхронизация между IndexedDB (локальное хранилище) и MinIO (сервер)
// Использует TPEP формат для обмена данными

// ============ Константы ============
const SYNC_DB_NAME = 'tis_project_sync';
const SYNC_DB_VERSION = 1;
const SYNC_STORE_PROJECTS = 'projects';
const SYNC_STORE_METADATA = 'metadata';
const API_BASE_URL = window.location.origin;

// Статусы синхронизации
const SYNC_STATUS = {
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    CONFLICT: 'conflict',
    ERROR: 'error'
};

// ============ IndexedDB Manager ============
class ProjectSyncDB {
    constructor() {
        this.db = null;
        this.dbName = SYNC_DB_NAME;
        this.version = SYNC_DB_VERSION;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Хранилище проектов
                if (!db.objectStoreNames.contains(SYNC_STORE_PROJECTS)) {
                    const projectStore = db.createObjectStore(SYNC_STORE_PROJECTS, { 
                        keyPath: 'projectId' 
                    });
                    projectStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
                    projectStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    projectStore.createIndex('owner', 'owner', { unique: false });
                }

                // Хранилище метаданных синхронизации
                if (!db.objectStoreNames.contains(SYNC_STORE_METADATA)) {
                    const metaStore = db.createObjectStore(SYNC_STORE_METADATA, { 
                        keyPath: 'key' 
                    });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(new Error(`IndexedDB error: ${event.target.errorCode}`));
            };
        });
    }

    async saveProject(projectData) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SYNC_STORE_PROJECTS], 'readwrite');
            const store = transaction.objectStore(SYNC_STORE_PROJECTS);
            
            const record = {
                projectId: projectData.id,
                tpfData: projectData.tpfData,
                lastUpdate: new Date().toISOString(),
                syncStatus: SYNC_STATUS.PENDING,
                retryCount: 0,
                checksum: projectData.checksum
            };

            const request = store.put(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getProject(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SYNC_STORE_PROJECTS], 'readonly');
            const store = transaction.objectStore(SYNC_STORE_PROJECTS);
            const request = store.get(projectId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllProjects() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SYNC_STORE_PROJECTS], 'readonly');
            const store = transaction.objectStore(SYNC_STORE_PROJECTS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateSyncStatus(projectId, status, metadata = {}) {
        await this.init();
        return new Promise(async (resolve, reject) => {
            try {
                const project = await this.getProject(projectId);
                if (!project) {
                    reject(new Error(`Project ${projectId} not found`));
                    return;
                }

                project.syncStatus = status;
                project.lastSyncAttempt = new Date().toISOString();
                
                if (metadata.checksum) project.checksum = metadata.checksum;
                if (metadata.serverVersion) project.serverVersion = metadata.serverVersion;
                if (status === SYNC_STATUS.SYNCED) {
                    project.retryCount = 0;
                } else if (status === SYNC_STATUS.ERROR) {
                    project.retryCount = (project.retryCount || 0) + 1;
                }

                const transaction = this.db.transaction([SYNC_STORE_PROJECTS], 'readwrite');
                const store = transaction.objectStore(SYNC_STORE_PROJECTS);
                const request = store.put(project);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async setMetadata(key, value) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SYNC_STORE_METADATA], 'readwrite');
            const store = transaction.objectStore(SYNC_STORE_METADATA);
            const request = store.put({ key, value, timestamp: new Date().toISOString() });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getMetadata(key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SYNC_STORE_METADATA], 'readonly');
            const store = transaction.objectStore(SYNC_STORE_METADATA);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProject(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([SYNC_STORE_PROJECTS], 'readwrite');
            const store = transaction.objectStore(SYNC_STORE_PROJECTS);
            const request = store.delete(projectId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                [SYNC_STORE_PROJECTS, SYNC_STORE_METADATA], 
                'readwrite'
            );
            
            transaction.objectStore(SYNC_STORE_PROJECTS).clear();
            transaction.objectStore(SYNC_STORE_METADATA).clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// ============ Sync Manager ============
class ProjectSyncManager {
    constructor() {
        this.db = new ProjectSyncDB();
        this.syncInterval = null;
        this.isSyncing = false;
        this.eventListeners = new Map();
    }

    // Подписка на события
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    // Отписка от событий
    off(event, callback) {
        if (!this.eventListeners.has(event)) return;
        
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    // Уведомление слушателей
    emit(event, data) {
        if (!this.eventListeners.has(event)) return;
        
        this.eventListeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * Сохранение проекта в локальную базу и очередь на синхронизацию
     */
    async saveProjectLocal(project) {
        try {
            // Сериализуем проект в TPF формат
            const tpfData = await window.TPEP.serializeToTPF(project);
            
            // Сохраняем в IndexedDB
            await this.db.saveProject({
                id: tpfData.tpf.projectId,
                tpfData: tpfData,
                checksum: tpfData.tpf.checksum
            });

            this.emit('projectSaved', { 
                projectId: tpfData.tpf.projectId,
                status: SYNC_STATUS.PENDING 
            });

            // Запускаем синхронизацию если не запущена
            if (!this.syncInterval) {
                this.startAutoSync();
            }

            return tpfData.tpf.projectId;
        } catch (error) {
            console.error('Error saving project locally:', error);
            this.emit('error', { 
                action: 'saveLocal', 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Загрузка проекта из сервера
     */
    async loadProjectFromServer(projectId) {
        try {
            this.emit('syncStart', { projectId, direction: 'download' });

            const response = await fetch(`${API_BASE_URL}/load_project/${projectId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success || !result.data) {
                throw new Error('Invalid server response');
            }

            // Десериализуем TPF данные
            const project = window.TPEP.deserializeFromTPF(result.data);

            // Сохраняем в локальную базу
            await this.db.saveProject({
                id: projectId,
                tpfData: result.data,
                checksum: result.data.tpf.checksum
            });

            await this.db.updateSyncStatus(projectId, SYNC_STATUS.SYNCED, {
                checksum: result.data.tpf.checksum,
                serverVersion: result.data.tpf.timestamp
            });

            this.emit('projectLoaded', { projectId, project });
            return project;
        } catch (error) {
            console.error('Error loading project from server:', error);
            this.emit('error', { 
                action: 'loadFromServer', 
                projectId,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Синхронизация проекта с сервером
     */
    async syncProjectWithServer(projectId) {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return;
        }

        this.isSyncing = true;
        let retryCount = 0;

        try {
            const localRecord = await this.db.getProject(projectId);
            
            if (!localRecord) {
                throw new Error(`Project ${projectId} not found in local DB`);
            }

            if (localRecord.syncStatus === SYNC_STATUS.SYNCED) {
                console.log(`Project ${projectId} is already synced`);
                return;
            }

            await this.db.updateSyncStatus(projectId, SYNC_STATUS.SYNCING);
            this.emit('syncStart', { projectId, direction: 'upload' });

            // Отправляем на сервер
            const response = await fetch(`${API_BASE_URL}/save_project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localRecord.tpfData)
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Server rejected the project');
            }

            // Обновляем статус
            await this.db.updateSyncStatus(projectId, SYNC_STATUS.SYNCED, {
                checksum: localRecord.tpfData.tpf.checksum,
                serverVersion: localRecord.tpfData.tpf.timestamp
            });

            this.emit('syncComplete', { 
                projectId, 
                direction: 'upload',
                result 
            });

        } catch (error) {
            console.error('Error syncing project:', error);
            
            retryCount = (await this.db.getProject(projectId))?.retryCount || 0;
            
            if (retryCount >= MAX_SYNC_RETRIES) {
                await this.db.updateSyncStatus(projectId, SYNC_STATUS.ERROR);
                this.emit('syncFailed', { 
                    projectId, 
                    error: error.message,
                    reason: 'max_retries_exceeded'
                });
            } else {
                await this.db.updateSyncStatus(projectId, SYNC_STATUS.PENDING);
                this.emit('syncRetry', { 
                    projectId, 
                    retryCount: retryCount + 1,
                    error: error.message 
                });
            }
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Синхронизация всех ожидающих проектов
     */
    async syncAllPending() {
        const projects = await this.db.getAllProjects();
        const pendingProjects = projects.filter(
            p => p.syncStatus === SYNC_STATUS.PENDING || 
                 p.syncStatus === SYNC_STATUS.ERROR
        );

        console.log(`Found ${pendingProjects.length} pending projects to sync`);

        for (const project of pendingProjects) {
            await this.syncProjectWithServer(project.projectId);
        }
    }

    /**
     * Запуск автоматической синхронизации
     */
    startAutoSync(interval = SYNC_INTERVAL) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            this.syncAllPending();
        }, interval);

        this.emit('autoSyncStarted', { interval });
        console.log(`Auto-sync started with interval ${interval}ms`);
    }

    /**
     * Остановка автоматической синхронизации
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            this.emit('autoSyncStopped');
            console.log('Auto-sync stopped');
        }
    }

    /**
     * Получение статуса синхронизации проекта
     */
    async getSyncStatus(projectId) {
        const project = await this.db.getProject(projectId);
        return project ? project.syncStatus : null;
    }

    /**
     * Получение всех проектов из локальной базы
     */
    async getAllLocalProjects() {
        return await this.db.getAllProjects();
    }

    /**
     * Разрешение конфликта версий
     */
    async resolveConflict(projectId, strategy = CONFLICT_RESOLUTION_STRATEGY) {
        const localRecord = await this.db.getProject(projectId);
        
        if (!localRecord) {
            throw new Error(`Project ${projectId} not found`);
        }

        try {
            // Загружаем версию с сервера
            const serverResponse = await fetch(`${API_BASE_URL}/load_project/${projectId}`);
            const serverData = await serverResponse.json();

            if (!serverData.success) {
                // Проекта нет на сервере, используем локальную версию
                await this.syncProjectWithServer(projectId);
                return 'local_wins';
            }

            const serverTimestamp = new Date(serverData.data.tpf.timestamp);
            const localTimestamp = new Date(localRecord.tpfData.tpf.timestamp);

            switch (strategy) {
                case 'lastWriteWins':
                    if (serverTimestamp > localTimestamp) {
                        // Сервер новее, загружаем его версию
                        const project = window.TPEP.deserializeFromTPF(serverData.data);
                        await this.db.saveProject({
                            id: projectId,
                            tpfData: serverData.data,
                            checksum: serverData.data.tpf.checksum
                        });
                        return 'server_wins';
                    } else {
                        // Локальная версия новее
                        await this.syncProjectWithServer(projectId);
                        return 'local_wins';
                    }

                case 'serverWins':
                    const project = window.TPEP.deserializeFromTPF(serverData.data);
                    await this.db.saveProject({
                        id: projectId,
                        tpfData: serverData.data,
                        checksum: serverData.data.tpf.checksum
                    });
                    return 'server_wins';

                case 'manual':
                    await this.db.updateSyncStatus(projectId, SYNC_STATUS.CONFLICT);
                    this.emit('conflictDetected', {
                        projectId,
                        localVersion: localRecord.tpfData,
                        serverVersion: serverData.data,
                        localTimestamp: localTimestamp,
                        serverTimestamp: serverTimestamp
                    });
                    return 'manual_resolution_required';

                default:
                    throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
            }
        } catch (error) {
            console.error('Error resolving conflict:', error);
            throw error;
        }
    }

    /**
     * Удаление проекта с сервера и локально
     */
    async deleteProject(projectId) {
        try {
            this.emit('deleteStart', { projectId });

            // Удаляем с сервера
            await fetch(`${API_BASE_URL}/delete_project/${projectId}`, {
                method: 'DELETE'
            });

            // Удаляем локально
            await this.db.deleteProject(projectId);

            this.emit('deleteComplete', { projectId });
        } catch (error) {
            console.error('Error deleting project:', error);
            this.emit('error', { 
                action: 'delete', 
                projectId,
                error: error.message 
            });
            throw error;
        }
    }
}

// ============ Экспорт ============
window.ProjectSyncDB = ProjectSyncDB;
window.ProjectSyncManager = ProjectSyncManager;
window.SYNC_STATUS = SYNC_STATUS;

// Создаем глобальный экземпляр менеджера синхронизации
window.projectSyncManager = new ProjectSyncManager();
