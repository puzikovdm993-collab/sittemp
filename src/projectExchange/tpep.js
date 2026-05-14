// ============ TIS Project Exchange Protocol (TPEP) ============
// Новый формат и протокол обмена проектами между клиентом и сервером
// Версия: 1.0.0

/**
 * TPEP Project Format Structure:
 * {
 *   "tpf": {
 *     "version": "1.0.0",
 *     "projectId": "uuid",
 *     "timestamp": "ISO8601",
 *     "checksum": "sha256",
 *     "metadata": {...},
 *     "snapshot": {...}
 *   }
 * }
 */

// ============ Константы и настройки ============
const TPEP_VERSION = '1.0.0';
const TPF_MIME_TYPE = 'application/tpf+json';
const SYNC_INTERVAL = 30000; // 30 секунд
const MAX_SYNC_RETRIES = 3;
const CONFLICT_RESOLUTION_STRATEGY = 'lastWriteWins'; // или 'manual', 'serverWins'

// ============ Утилиты ============

/**
 * Генерация UUID v4
 */
function generateUUID() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Вычисление SHA-256 хеша для данных
 */
async function computeChecksum(data) {
    const encoder = new TextEncoder();
    const dataArray = encoder.encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Получение текущей метки времени в ISO8601
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Глубокое клонирование объекта
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// ============ TPF (TIS Project Format) Serializer ============

/**
 * Сериализация проекта в TPF формат
 * @param {Object} project - Объект проекта
 * @param {Object} options - Опции сериализации
 * @returns {Promise<Object>} TPF объект
 */
async function serializeToTPF(project, options = {}) {
    const {
        includeHistory = true,
        includeThumbnails = false,
        compression = false
    } = options;

    // Очистка проекта от не сериализуемых объектов
    const cleanedProject = cleanProjectForSerialization(project, includeHistory);

    // Вычисляем чексумм
    const checksum = await computeChecksum(cleanedProject);

    // Создаем TPF объект
    const tpf = {
        tpf: {
            version: TPEP_VERSION,
            projectId: project.id || generateUUID(),
            timestamp: getTimestamp(),
            checksum: checksum,
            metadata: {
                name: project.name || 'Unnamed Project',
                type: project.type || 'graphic',
                owner: project.owner || 'anonymous',
                createdAt: project.createdAt || getTimestamp(),
                lastUpdate: project.lastUpdate || getTimestamp(),
                settings: project.settings || {},
                fileCount: project.files ? project.files.length : 0,
                totalSize: estimateProjectSize(project),
                clientInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language
                }
            },
            snapshot: {
                project: cleanedProject,
                files: includeHistory ? 
                    project.files?.map(f => ({
                        id: f.id,
                        filename: f.filename,
                        matrix: f.matrix,
                        minValue: f.minValue,
                        maxValue: f.maxValue,
                        width: f.width,
                        height: f.height,
                        dpi: f.dpi,
                        autoscale: f.autoscale,
                        colormap: f.colormap,
                        history: f.history || [],
                        historyIndex: f.historyIndex || -1,
                        selection: f.selection || []
                    })) : 
                    project.files?.map(f => ({
                        id: f.id,
                        filename: f.filename,
                        matrix: f.matrix,
                        minValue: f.minValue,
                        maxValue: f.maxValue,
                        width: f.width,
                        height: f.height,
                        dpi: f.dpi,
                        autoscale: f.autoscale,
                        colormap: f.colormap
                    }))
            }
        }
    };

    return tpf;
}

/**
 * Десериализация TPF формата обратно в проект
 * @param {Object} tpfData - TPF объект
 * @returns {Object} Проект
 */
function deserializeFromTPF(tpfData) {
    if (!tpfData || !tpfData.tpf) {
        throw new Error('Invalid TPF format: missing tpf root object');
    }

    const tpf = tpfData.tpf;
    
    // Проверка версии
    if (tpf.version !== TPEP_VERSION) {
        console.warn(`TPF version mismatch: expected ${TPEP_VERSION}, got ${tpf.version}`);
    }

    // Проверка чексумма (опционально)
    // TODO: реализовать проверку чексумма

    const snapshot = tpf.snapshot;
    const projectData = snapshot.project;

    // Восстанавливаем проект
    const project = {
        id: tpf.projectId,
        name: tpf.metadata?.name || 'Unnamed Project',
        type: tpf.metadata?.type || 'graphic',
        owner: tpf.metadata?.owner || 'anonymous',
        createdAt: tpf.metadata?.createdAt || tpf.timestamp,
        lastUpdate: tpf.metadata?.lastUpdate || tpf.timestamp,
        settings: tpf.metadata?.settings || {},
        files: []
    };

    // Восстанавливаем файлы
    if (snapshot.files && Array.isArray(snapshot.files)) {
        snapshot.files.forEach(fileData => {
            const file = {
                id: fileData.id,
                filename: fileData.filename || 'Unnamed',
                matrix: fileData.matrix || null,
                minValue: fileData.minValue || 0,
                maxValue: fileData.maxValue || 1,
                width: fileData.width || 0,
                height: fileData.height || 0,
                dpi: fileData.dpi || 96,
                autoscale: fileData.autoscale !== undefined ? fileData.autoscale : true,
                colormap: fileData.colormap || 'gray',
                history: fileData.history || [],
                historyIndex: fileData.historyIndex !== undefined ? fileData.historyIndex : -1,
                selection: fileData.selection || []
            };

            // Воссоздаем canvas и ctx
            if (file.width > 0 && file.height > 0) {
                const cnv = document.createElement('canvas');
                cnv.className = 'paint-canvas';
                cnv.id = `canvas-${file.id}`;
                cnv.width = file.width;
                cnv.height = file.height;
                cnv.style.display = 'none';

                if (typeof attachCanvasEvents === 'function') {
                    attachCanvasEvents(cnv);
                }

                const canvasHost = document.getElementById('canvasHost');
                if (canvasHost) {
                    canvasHost.appendChild(cnv);
                }

                file.canvas = cnv;
                file.ctx = cnv.getContext('2d', { willReadFrequently: true });

                // Рисуем матрицу на canvas
                if (file.matrix) {
                    renderMatrixToCanvas(file);
                }
            }

            project.files.push(file);
        });
    }

    return project;
}

/**
 * Отрисовка матрицы на canvas файла
 */
function renderMatrixToCanvas(file) {
    if (!file.matrix || !file.ctx || !file.canvas) return;

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
    const colormapName = colorBarNames[colorBar?.classList[1]] || 'gray';
    const colorMap = typeof getColormap === 'function' ? getColormap(colormapName) : null;

    if (!colorMap) return;

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
 * Очистка проекта от не сериализуемых объектов
 */
function cleanProjectForSerialization(project, includeHistory = true) {
    const cleaned = deepClone(project);

    if (cleaned.files && Array.isArray(cleaned.files)) {
        cleaned.files = cleaned.files.map(file => {
            const cleanedFile = { ...file };
            delete cleanedFile.canvas;
            delete cleanedFile.ctx;

            if (!includeHistory) {
                delete cleanedFile.history;
                delete cleanedFile.historyIndex;
            } else if (cleanedFile.history && Array.isArray(cleanedFile.history)) {
                // Очищаем историю от canvas и ctx
                cleanedFile.history = cleanedFile.history.map(step => {
                    const cleanedStep = { ...step };
                    delete cleanedStep.canvas;
                    delete cleanedStep.ctx;
                    return cleanedStep;
                });
            }

            return cleanedFile;
        });
    }

    return cleaned;
}

/**
 * Оценка размера проекта в байтах
 */
function estimateProjectSize(project) {
    let size = 0;
    const jsonStr = JSON.stringify(project);
    size = new Blob([jsonStr]).size;
    return size;
}

// ============ Экспорт модуля ============
window.TPEP = {
    VERSION: TPEP_VERSION,
    MIME_TYPE: TPF_MIME_TYPE,
    serializeToTPF,
    deserializeFromTPF,
    generateUUID,
    computeChecksum,
    getTimestamp,
    deepClone,
    cleanProjectForSerialization,
    estimateProjectSize
};
