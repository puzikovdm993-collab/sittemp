/**
 * Проектный модуль - новая архитектура обмена проектами между клиентом и сервером
 * Версия формата: 2.0
 * 
 * Особенности нового формата:
 * - Версионирование формата данных
 * - Разделение метаданных и контента
 * - Дельта-сериализация для истории изменений
 * - Поддержка совместной работы (блокировки, владельцы)
 * - Оптимизированная передача больших матриц (binary + base64 hybrid)
 * - Расширенные метаданные для поиска и категоризации
 */

// ==================== КОНСТАНТЫ И НАСТРОЙКИ ====================

const PROJECT_FORMAT_VERSION = '2.0';
const PROJECT_API_BASE = '/api/projects';

// Типы проектов
const ProjectType = {
    THERMAL_IMAGE: 'thermal_image',
    GRAPHIC_EDITOR: 'graphic_editor',
    ANALYSIS: 'analysis',
    COMPOSITE: 'composite'
};

// Статусы проекта
const ProjectStatus = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
    LOCKED: 'locked'
};

// Операции с проектом
const ProjectOperation = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LOAD: 'load',
    LIST: 'list',
    SHARE: 'share',
    EXPORT: 'export',
    IMPORT: 'import'
};

// ==================== КЛАСС PROJECT MANAGER ====================

class ProjectManager {
    constructor() {
        this.currentProject = null;
        this.projectCache = new Map();
        this.syncQueue = [];
        this.isSyncing = false;
        this.callbacks = {
            onSave: [],
            onLoad: [],
            onDelete: [],
            onSync: []
        };
    }

    // ==================== СЕРИАЛИЗАЦИЯ ====================

    /**
     * Сериализует проект в новый формат для отправки на сервер
     * @param {Object} project - объект проекта
     * @param {Object} options - опции сериализации
     * @returns {Promise<Object>} - сериализованный пакет данных
     */
    async serializeProject(project, options = {}) {
        const {
            includeHistory = true,
            includeThumbnails = true,
            compressionLevel = 'medium',
            deltaOnly = false
        } = options;

        // Создаем копию проекта без служебных объектов
        const cleanedProject = this.cleanProjectData(project);
        
        // Сериализуем матрицы файлов
        const serializedFiles = await Promise.all(
            cleanedProject.files.map(file => this.serializeFile(file, {
                includeHistory,
                compressionLevel,
                deltaOnly
            }))
        );

        // Формируем пакет данных в новом формате
        const payload = {
            // Мета-информация о пакете
            meta: {
                formatVersion: PROJECT_FORMAT_VERSION,
                timestamp: new Date().toISOString(),
                operation: deltaOnly ? ProjectOperation.UPDATE : ProjectOperation.CREATE,
                clientId: this.generateClientId(),
                compression: compressionLevel
            },
            
            // Основные данные проекта
            project: {
                id: project.id,
                name: project.name || 'Без названия',
                type: project.type || ProjectType.GRAPHIC_EDITOR,
                status: project.status || ProjectStatus.DRAFT,
                
                // Временные метки
                createdAt: project.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                
                // Владелец и доступ
                owner: project.owner || this.getCurrentUser(),
                permissions: project.permissions || this.getDefaultPermissions(),
                
                // Категоризация и теги
                category: project.category || '',
                tags: project.tags || [],
                description: project.description || '',
                
                // Настройки проекта
                settings: {
                    theme: project.settings?.theme || 'light',
                    defaultView: project.settings?.defaultView || 'list',
                    notifications: project.settings?.notifications ?? true,
                    autoSave: project.settings?.autoSave ?? true,
                    syncEnabled: project.settings?.syncEnabled ?? true
                },
                
                // Ссылки на файлы (контент отдельно)
                files: serializedFiles.map(f => ({
                    id: f.id,
                    filename: f.filename,
                    size: f.size,
                    dimensions: f.dimensions,
                    checksum: f.checksum,
                    hasContent: true
                }))
            },
            
            // Контент файлов (опционально включается)
            content: includeThumbnails ? {
                files: serializedFiles.map(f => ({
                    fileId: f.id,
                    matrix: f.matrix,
                    minValue: f.minValue,
                    maxValue: f.maxValue,
                    colormap: f.colormap,
                    history: includeHistory ? f.history : []
                }))
            } : null,
            
            // Контрольная сумма всего пакета
            checksum: await this.calculateChecksum(serializedFiles)
        };

        return payload;
    }

    /**
     * Сериализует отдельный файл проекта
     */
    async serializeFile(file, options = {}) {
        const { includeHistory = true, compressionLevel = 'medium', deltaOnly = false } = options;

        // Вычисляем контрольную сумму матрицы
        const checksum = await this.calculateMatrixChecksum(file.matrix);
        
        // Сериализуем историю изменений
        let history = [];
        if (includeHistory && file.history && file.history.length > 0) {
            if (deltaOnly && file.historyIndex >= 0) {
                // Только изменения с последнего сохранённого состояния
                history = file.history.slice(file.lastSavedHistoryIndex || 0);
            } else {
                // Последние N записей истории
                history = file.history.slice(-50);
            }
            
            // Удаляем canvas и ctx из истории
            history = history.map(h => {
                const clean = { ...h };
                delete clean.canvas;
                delete clean.ctx;
                return clean;
            });
        }

        return {
            id: file.id,
            filename: file.filename,
            dimensions: { width: file.width, height: file.height },
            dpi: file.dpi,
            autoscale: file.autoscale,
            colormap: file.colormap,
            minValue: file.minValue,
            maxValue: file.maxValue,
            matrix: this.encodeMatrix(file.matrix, compressionLevel),
            size: this.calculateFileSize(file),
            checksum,
            history,
            historyIndex: file.historyIndex,
            selection: file.selection || []
        };
    }

    /**
     * Кодирует матрицу для передачи (выбор формата: base64, binary, delta)
     */
    encodeMatrix(matrix, compressionLevel = 'medium') {
        if (!matrix || !Array.isArray(matrix)) {
            return { format: 'null', data: null };
        }

        const rows = matrix.length;
        const cols = matrix[0]?.length || 0;

        // Плоский массив данных
        const flatData = matrix.flat();
        
        // Выбор формата кодирования в зависимости от размера
        const dataSize = flatData.length * 4; // 4 байта на число
        
        if (dataSize < 1024 * 1024) { // < 1MB
            return {
                format: 'base64',
                encoding: 'float32',
                dimensions: [rows, cols],
                data: this.arrayToBase64(new Float32Array(flatData))
            };
        } else if (compressionLevel === 'high') {
            // Сжатие через delta-кодирование + base64
            const deltaEncoded = this.deltaEncode(flatData);
            return {
                format: 'base64_delta',
                encoding: 'int16',
                dimensions: [rows, cols],
                deltaBase: flatData[0],
                data: this.arrayToBase64(new Int16Array(deltaEncoded))
            };
        } else {
            // Стандартное base64 кодирование
            return {
                format: 'base64',
                encoding: 'float32',
                dimensions: [rows, cols],
                data: this.arrayToBase64(new Float32Array(flatData))
            };
        }
    }

    /**
     * Декодирует матрицу из формата передачи
     */
    decodeMatrix(encodedMatrix) {
        if (!encodedMatrix || encodedMatrix.format === 'null') {
            return null;
        }

        const { format, encoding, dimensions, data } = encodedMatrix;
        const [rows, cols] = dimensions;
        
        let typedArray;
        const binaryData = this.base64ToArray(data);

        switch (encoding) {
            case 'float32':
                typedArray = new Float32Array(binaryData.buffer);
                break;
            case 'int16':
                typedArray = new Int16Array(binaryData.buffer);
                break;
            case 'uint8':
                typedArray = new Uint8Array(binaryData.buffer);
                break;
            default:
                typedArray = new Float32Array(binaryData.buffer);
        }

        // Delta-декодирование если нужно
        if (format === 'base64_delta') {
            const deltaBase = encodedMatrix.deltaBase || 0;
            const decoded = this.deltaDecode(Array.from(typedArray), deltaBase);
            return this.reshapeArray(decoded, rows, cols);
        }

        return this.reshapeArray(Array.from(typedArray), rows, cols);
    }

    // ==================== ДЕСЕРИАЛИЗАЦИЯ ====================

    /**
     * Десериализует проект из формата сервера
     * @param {Object} payload - данные от сервера
     * @returns {Object} - объект проекта для приложения
     */
    async deserializeProject(payload) {
        // Проверка версии формата
        const serverVersion = payload.meta?.formatVersion || '1.0';
        if (!this.isCompatibleVersion(serverVersion)) {
            console.warn(`Несовместимая версия формата: ${serverVersion}`);
        }

        const projectData = payload.project;
        const content = payload.content;

        // Базовый объект проекта
        const project = {
            id: projectData.id,
            name: projectData.name,
            type: projectData.type,
            status: projectData.status,
            createdAt: projectData.createdAt,
            lastUpdate: projectData.updatedAt,
            owner: projectData.owner,
            permissions: projectData.permissions,
            category: projectData.category,
            tags: projectData.tags,
            description: projectData.description,
            settings: {
                theme: projectData.settings.theme,
                defaultView: projectData.settings.defaultView,
                notifications: projectData.settings.notifications,
                autoSave: projectData.settings.autoSave,
                syncEnabled: projectData.settings.syncEnabled
            },
            files: []
        };

        // Восстанавливаем файлы с контентом
        if (content?.files && Array.isArray(content.files)) {
            for (const fileContent of content.files) {
                const fileInfo = projectData.files.find(f => f.id === fileContent.fileId);
                if (!fileInfo) continue;

                const file = await this.deserializeFile(fileInfo, fileContent);
                project.files.push(file);
            }
        } else {
            // Только метаданные файлов (без контента)
            project.files = projectData.files.map(f => ({
                id: f.id,
                filename: f.filename,
                dimensions: f.dimensions,
                size: f.size,
                checksum: f.checksum
            }));
        }

        return project;
    }

    /**
     * Десериализует отдельный файл
     */
    async deserializeFile(fileInfo, fileContent) {
        const file = {
            id: fileInfo.id,
            filename: fileInfo.filename,
            width: fileInfo.dimensions?.width,
            height: fileInfo.dimensions?.height,
            dpi: fileInfo.dpi,
            autoscale: fileInfo.autoscale,
            colormap: fileInfo.colormap,
            minValue: fileContent?.minValue,
            maxValue: fileContent?.maxValue,
            matrix: this.decodeMatrix(fileContent?.matrix),
            history: fileContent?.history || [],
            historyIndex: fileContent?.historyIndex || -1,
            lastSavedHistoryIndex: fileContent?.history?.length || 0,
            selection: fileContent?.selection || []
        };

        // Создаём canvas для файла
        if (file.matrix && file.width && file.height) {
            file.canvas = this.createCanvasForFile(file);
            file.ctx = file.canvas.getContext('2d', { willReadFrequently: true });
            this.renderMatrixToCanvas(file);
        }

        return file;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    /**
     * Очищает проект от служебных объектов перед сериализацией
     */
    cleanProjectData(project) {
        const cleaned = JSON.parse(JSON.stringify(project));
        
        // Удаляем canvas и ctx из всех файлов
        if (cleaned.files && Array.isArray(cleaned.files)) {
            cleaned.files.forEach(file => {
                delete file.canvas;
                delete file.ctx;
                
                // Очищаем историю от canvas/ctx
                if (file.history && Array.isArray(file.history)) {
                    file.history.forEach(h => {
                        delete h.canvas;
                        delete h.ctx;
                    });
                }
            });
        }

        return cleaned;
    }

    /**
     * Создаёт canvas элемент для файла
     */
    createCanvasForFile(file) {
        const canvas = document.createElement('canvas');
        canvas.className = 'paint-canvas';
        canvas.id = `canvas-${file.id}`;
        canvas.width = file.width;
        canvas.height = file.height;
        canvas.style.display = 'none';
        
        attachCanvasEvents(canvas);
        
        const canvasHost = document.getElementById('canvasHost');
        if (canvasHost) {
            canvasHost.appendChild(canvas);
        }
        
        return canvas;
    }

    /**
     * Рендерит матрицу на canvas
     */
    renderMatrixToCanvas(file) {
        if (!file.matrix || !file.ctx || !file.width || !file.height) return;

        const colorBar = document.getElementById('colorBar');
        const colormapName = this.getCurrentColormap(colorBar);
        const colorMap = getColormap(colormapName);

        const data = new Uint8ClampedArray(file.width * file.height * 4);
        let dataIndex = 0;

        for (let y = 0; y < file.height; y++) {
            for (let x = 0; x < file.width; x++) {
                const normalizedValue = (file.matrix[y][x] - file.minValue) / 
                    (file.maxValue - file.minValue + 1e-9);
                const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
                data[dataIndex++] = color.r;
                data[dataIndex++] = color.g;
                data[dataIndex++] = color.b;
                data[dataIndex++] = 255;
            }
        }

        const imageData = new ImageData(data, file.width, file.height);
        file.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Вычисляет контрольную сумму матрицы
     */
    async calculateMatrixChecksum(matrix) {
        if (!matrix) return 'empty';
        
        const flatData = JSON.stringify(matrix.flat());
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(flatData));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    /**
     * Вычисляет контрольную сумму всего пакета
     */
    async calculateChecksum(files) {
        const combined = files.map(f => f.checksum).join(':');
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    /**
     * Вычисляет размер файла в байтах
     */
    calculateFileSize(file) {
        if (!file.matrix) return 0;
        const rows = file.matrix.length;
        const cols = file.matrix[0]?.length || 0;
        return rows * cols * 4; // 4 байта на float32
    }

    /**
     * Преобразует TypedArray в base64
     */
    arrayToBase64(typedArray) {
        const bytes = new Uint8Array(typedArray.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Преобразует base64 обратно в Uint8Array
     */
    base64ToArray(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Delta-кодирование массива
     */
    deltaEncode(data) {
        if (data.length === 0) return [];
        const result = [data[0]];
        for (let i = 1; i < data.length; i++) {
            result.push(Math.round(data[i] - data[i - 1]));
        }
        return result;
    }

    /**
     * Delta-декодирование массива
     */
    deltaDecode(encoded, base) {
        if (encoded.length === 0) return [];
        const result = [base];
        for (let i = 1; i < encoded.length; i++) {
            result.push(result[i - 1] + encoded[i]);
        }
        return result;
    }

    /**
     * Преобразует плоский массив в 2D матрицу
     */
    reshapeArray(flat, rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix.push(flat.slice(i * cols, (i + 1) * cols));
        }
        return matrix;
    }

    /**
     * Генерирует ID клиента
     */
    generateClientId() {
        if (!this.clientId) {
            this.clientId = 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }
        return this.clientId;
    }

    /**
     * Получает текущего пользователя
     */
    getCurrentUser() {
        // Здесь должна быть интеграция с системой авторизации
        return 'anonymous';
    }

    /**
     * Возвращает права доступа по умолчанию
     */
    getDefaultPermissions() {
        return {
            read: true,
            write: true,
            delete: true,
            share: false
        };
    }

    /**
     * Проверяет совместимость версий формата
     */
    isCompatibleVersion(version) {
        const major = version.split('.')[0];
        const currentMajor = PROJECT_FORMAT_VERSION.split('.')[0];
        return major === currentMajor;
    }

    /**
     * Получает текущую colormap из UI
     */
    getCurrentColormap(colorBarElement) {
        const colorBarNames = {
            'color-bar-gray': 'gray',
            'color-bar-plasma': 'plasma',
            'color-bar-inferno': 'inferno',
            'color-bar-magma': 'magma',
            'color-bar-cividis': 'cividis',
            'color-bar-rainbow': 'rainbow',
            'color-bar-coolwarm': 'coolwarm'
        };
        
        if (!colorBarElement) return 'gray';
        
        const activeClass = Array.from(colorBarElement.classList)
            .find(cls => cls.startsWith('color-bar-'));
        
        return colorBarNames[activeClass] || 'gray';
    }

    // ==================== API МЕТОДЫ ====================

    /**
     * Сохраняет проект на сервер
     */
    async saveProject(project, options = {}) {
        try {
            const payload = await this.serializeProject(project, options);
            
            const response = await fetch(`${PROJECT_API_BASE}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            if (result.success) {
                this.currentProject = project;
                this.notifyCallbacks('onSave', result);
            }
            
            return result;
        } catch (error) {
            console.error('Ошибка сохранения проекта:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Загружает проект с сервера
     */
    async loadProject(projectId, options = {}) {
        try {
            const queryParams = new URLSearchParams({
                includeContent: options.includeContent !== false,
                includeHistory: options.includeHistory !== false
            }).toString();
            
            const response = await fetch(`${PROJECT_API_BASE}/load/${projectId}?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const payload = await response.json();
            const project = await this.deserializeProject(payload);
            
            this.currentProject = project;
            this.notifyCallbacks('onLoad', project);
            
            return project;
        } catch (error) {
            console.error('Ошибка загрузки проекта:', error);
            throw error;
        }
    }

    /**
     * Получает список проектов
     */
    async listProjects(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`${PROJECT_API_BASE}/list?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const result = await response.json();
            return result.projects || [];
        } catch (error) {
            console.error('Ошибка получения списка проектов:', error);
            return [];
        }
    }

    /**
     * Удаляет проект
     */
    async deleteProject(projectId) {
        try {
            const response = await fetch(`${PROJECT_API_BASE}/delete/${projectId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.projectCache.delete(projectId);
                if (this.currentProject?.id === projectId) {
                    this.currentProject = null;
                }
                this.notifyCallbacks('onDelete', { projectId });
            }
            
            return result;
        } catch (error) {
            console.error('Ошибка удаления проекта:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Экспортирует проект в файл
     */
    async exportProject(projectId, format = 'json') {
        try {
            const response = await fetch(`${PROJECT_API_BASE}/export/${projectId}?format=${format}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_${projectId}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка экспорта проекта:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== CALLBACKS ====================

    /**
     * Регистрирует callback
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    /**
     * Удаляет callback
     */
    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Уведомляет callbacks
     */
    notifyCallbacks(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => {
                try {
                    cb(data);
                } catch (error) {
                    console.error(`Ошибка в callback ${event}:`, error);
                }
            });
        }
    }
}

// ==================== ЭКСПОРТ ЕДИНСТВЕННОГО ЭКЗЕМПЛЯРА ====================

const projectManager = new ProjectManager();

// Для обратной совместимости
window.ProjectManager = ProjectManager;
window.projectManager = projectManager;
window.PROJECT_FORMAT_VERSION = PROJECT_FORMAT_VERSION;
