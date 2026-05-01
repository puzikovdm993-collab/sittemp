// ============ Функции для работы с сервером ============

// ============ Двухпанельный менеджер сервера (Total Commander style) ============

let leftPanelPath = '/';
let rightPanelPath = '/';
let activePanel = 'left';
let selectedLeftItem = null;      // { fullPath, isFolder, displayName }
let selectedRightItem = null;

// Открыть менеджер
function showServerCommander(mode = 'open', callback = null) {
    commanderMode = mode;
    commanderCallback = callback;

    const modal = document.getElementById('serverCommanderModal');
    if (!modal) return;
    modal.classList.add('active');

    // Устанавливаем заголовок
    const titleSpan = modal.querySelector('.modal-title span');
    if (titleSpan) {
        titleSpan.textContent = mode === 'open' ? 'Выберите файл с сервера' : 'Выберите папку для сохранения';
    }

    // Настраиваем кнопку "Выбрать"
    const selectBtn = document.getElementById('commanderSelectBtn');
    if (selectBtn) {
        selectBtn.textContent = mode === 'open' ? 'Выбрать файл' : 'Сохранить сюда';
        selectBtn.style.display = 'inline-block';
    }

    // Сбрасываем выделение и пути (при желании можно сохранять последние пути)
    selectedLeftItem = null;
    selectedRightItem = null;
    activePanel = 'left'; // левая панель активна по умолчанию

    // Загружаем обе панели
    loadPanelList('left');
    loadPanelList('right');

    updateActivePanelHighlight(); // <-- добавить здесь
}
// Загрузить список файлов для указанной панели
async function loadPanelList(panel) {
    const tbody = document.getElementById(panel + 'PanelList');
    if (!tbody) return;

    const path = panel === 'left' ? leftPanelPath : rightPanelPath;
    const pathInput = document.getElementById(panel + 'Path');
    if (pathInput) pathInput.value = path;

    tbody.innerHTML = `<tr><td colspan="4" style="padding:20px;text-align:center;">Загрузка...</td></tr>`;

    try {
        const response = await fetch('/list_minio');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Некорректный ответ сервера');

        const allFiles = data.map(item => ({
            name: item.name || '',
            size: item.size || 0,
            modified: item.last_modified || item.created || null,
        }));

        renderPanelList(panel, allFiles, path);
        updateActivePanelHighlight(); // <-- добавить здесь
    } catch (error) {
        console.error('Ошибка загрузки списка:', error);
        tbody.innerHTML = `<tr><td colspan="4" style="padding:20px;text-align:center;color:#c62828;">Ошибка загрузки: ${error.message}</td></tr>`;
    }
}

function updateActivePanelHighlight() {
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    const leftHeader = leftPanel?.querySelector('.panel-header');
    const rightHeader = rightPanel?.querySelector('.panel-header');

    // Сначала снимаем выделение со всех
    [leftPanel, rightPanel].forEach(p => p?.classList.remove('active-panel'));
    [leftHeader, rightHeader].forEach(h => h?.classList.remove('active-header'));

    // Добавляем классы активной панели
    if (activePanel === 'left') {
        leftPanel?.classList.add('active-panel');
        leftHeader?.classList.add('active-header');
    } else {
        rightPanel?.classList.add('active-panel');
        rightHeader?.classList.add('active-header');
    }
}

function renderPanelList(panel, allFiles, currentPath) {
    const tbody = document.getElementById(panel + 'PanelList');
    if (!tbody) return;

    let prefix = currentPath === '/' ? '' : currentPath;
    if (prefix && !prefix.endsWith('/')) prefix += '/';

    const items = allFiles.filter(item => item.name.startsWith(prefix));

    const folders = new Set();
    const files = [];

    items.forEach(item => {
        const relative = item.name.slice(prefix.length);
        if (!relative) return;
        const parts = relative.split('/');
        if (parts.length > 1) {
            folders.add(parts[0] + '/');
        } else {
            files.push(item);
        }
    });

    let folderList = Array.from(folders).sort((a, b) => a.localeCompare(b));
    files.sort((a, b) => a.name.localeCompare(b.name));

    let html = '';

    // ===== Строка ".." для перехода вверх =====
    if (currentPath !== '/') {
        html += `
            <tr class="folder-row" ondblclick="navigateUp('${panel}')">
                <td>↑ ..</td>
                <td class="file-size">—</td>
                <td class="file-date">—</td>
                <td style="text-align:center;"></td>
            </tr>
        `;
    }

    // Папки
    folderList.forEach(folder => {
        const folderName = folder.slice(0, -1);
        const fullFolderPath = prefix + folder;
        const isSelected = (panel === 'left' && selectedLeftItem && selectedLeftItem.fullPath === fullFolderPath && selectedLeftItem.isFolder) ||
                           (panel === 'right' && selectedRightItem && selectedRightItem.fullPath === fullFolderPath && selectedRightItem.isFolder);
        const selectedClass = isSelected ? 'selected-row' : '';
        html += `
            <tr class="folder-row ${selectedClass}" 
                onclick="selectItem('${panel}', '${fullFolderPath}', true, '${folderName}')" 
                ondblclick="navigatePanel('${panel}', '${fullFolderPath}')">
                <td>📁 ${folderName}</td>
                <td class="file-size">—</td>
                <td class="file-date">—</td>
                <td style="text-align:center;"></td>
            </tr>
        `;
    });

    // Файлы
    files.forEach(file => {
        const fileName = file.name.slice(prefix.length);
        const fileSize = formatFileSize(file.size);
        const fileDate = file.modified ? new Date(file.modified).toLocaleString() : '—';
        const isSelected = (panel === 'left' && selectedLeftItem && selectedLeftItem.fullPath === file.name && !selectedLeftItem.isFolder) ||
                           (panel === 'right' && selectedRightItem && selectedRightItem.fullPath === file.name && !selectedRightItem.isFolder);
        const selectedClass = isSelected ? 'selected-row' : '';
        html += `
            <tr class="file-row ${selectedClass}" 
                onclick="selectItem('${panel}', '${file.name}', false, '${fileName}')" 
                ondblclick="onItemDblClick('${file.name}', false)">
                <td>📄 ${fileName}</td>
                <td class="file-size">${fileSize}</td>
                <td class="file-date">${fileDate}</td>
                <td style="text-align:center;"></td>
            </tr>
        `;
    });

    if (folderList.length === 0 && files.length === 0 && currentPath === '/') {
        html = `<tr><td colspan="4" style="padding:20px;text-align:center;">Папка пуста</td></tr>`;
    }

    tbody.innerHTML = html;
}

function makePanelClickable(panelId) {
    const panel = document.getElementById(panelId);
    panel?.addEventListener('click', (e) => {
        // Не перехватываем клики по кнопкам внутри панели (если они появятся)
        if (e.target.closest('button')) return;
        activePanel = panelId === 'leftPanel' ? 'left' : 'right';
        updateActivePanelHighlight();
    });
}
// Вызвать после создания панелей (например, в showServerCommander)
makePanelClickable('leftPanel');
makePanelClickable('rightPanel');

function commanderSelect() {
    if (!commanderCallback) {
        closeServerCommander();
        return;
    }

    if (commanderMode === 'open') {
        // Выбор файла
        const selected = activePanel === 'left' ? selectedLeftItem : selectedRightItem;
        if (!selected || selected.isFolder) {
            alert('Выберите файл');
            return;
        }
        commanderCallback(selected.fullPath);
        closeServerCommander();
    } else { // режим save
        // Используем текущий путь активной панели как папку для сохранения
        const folderPath = activePanel === 'left' ? leftPanelPath : rightPanelPath;
        commanderCallback(folderPath);
        closeServerCommander();
    }
}

function closeServerCommander() {
    const modal = document.getElementById('serverCommanderModal');
    if (modal) modal.classList.remove('active');
    selectedLeftItem = null;
    selectedRightItem = null;
}

/**
 * Функция для отображения модального окна с предложением названия файла
 * при загрузке изображения (например, для сохранения чертежа в формате .png).
 * Автоматически подставляет имя текущего файла без расширения.
 */
 function showFilenameModal() {
    // Получаем активный файл
    const file = getActiveFile();

    // Проверяем, что файл существует и модальное 
    // окно с ID 'filenameModal' доступно в DOM
    if (!file || !document.getElementById('filenameModal')) return;
    
    // Извлекаем базовое имя файла (без расширения), разбивая строку по точке:
    // - Например, для "drawing.vdxf" получим "drawing"
    // - Если имя файла без точки (например, "image"), используем его как есть
    // - Если имя отсутствует (file.filename == null), устанавливаем 'drawing' по умолчанию
    const defaultName = file.filename.split('.')[0] || 'drawing';

    // Устанавливаем значение в поле ввода модального окна:
    // - Добавляем расширение '.png' к базовому имени
    // - Например, если defaultName = 'drawing', то результат 'drawing.png'
    document.getElementById('serverFilename').value = `${defaultName}`;

    // Сбрасываем состояние модального окна (очистка полей, скрытие ошибок и т. д.)
    resetUploadModal();

    // Добавляем класс 'active' к модальному окну, чтобы сделать его видимым
    // (обычно стили 'active' управляют отображением через CSS)
    document.getElementById('filenameModal').classList.add('active');
}

function resetUploadModal() {
    hideUploadProgress();
    const uploadResult = document.getElementById('uploadResult');
    const uploadError = document.getElementById('uploadError');
    
    if (uploadResult) uploadResult.style.display = 'none';
    if (uploadError) uploadError.style.display = 'none';
    resetUploadButtons();
}

function resetUploadButtons() {
    const uploadButton = document.getElementById('uploadButton');
    const cancelButton = document.getElementById('cancelButton');
    
    if (uploadButton) uploadButton.disabled = false;
    if (cancelButton) cancelButton.disabled = false;
}

function hideUploadProgress() {
    const uploadStatus = document.getElementById('uploadStatus');
    if (uploadStatus) uploadStatus.style.display = 'none';
}

function loadToServer() {
    closeLoadMethodModal();
    showServerCommander('open', (filePath) => {
        console.log('showServerCommander("open", (filePath) => {');
        loadImageFromServer(filePath); 
    });
}

function saveToServer() {
    closeSaveMethodModal();
    showServerCommander('save', (filePath) => {

        console.log('showServerCommander("save", (filePath) => {');
        console.log(filePath);
        // Заполняем поле пути в filenameModal
        //document.getElementById('serverFolderPath').value = folderPath;
        // Вызываем существующую функцию показа окна с именем файла
        showFilenameModal();
    });
}
function closeFilenameModal() {
    const modal = document.getElementById('filenameModal');
    if (modal) {
        modal.classList.remove('active');
    }
    resetUploadModal();
}
function uploadToServer() {
    const file = getActiveFile();
    if (!file || !file.canvas) {
        showUploadError('Нет активного файла', 'Сначала создайте или откройте изображение');
        return;
    }

    const filenameInput = document.getElementById('serverFilename');
    const folderInput = document.getElementById('serverFolderPath');
    const formatSelect = document.getElementById('serverFormat');
    const addTimestamp = document.getElementById('addTimestamp');



    let filename = filenameInput.value.trim();
    let folder = activePanel === 'left' ? leftPanelPath : rightPanelPath;

    // Нормализуем путь: убираем лишние слеши
    if (folder) {
        // Убираем начальный слеш, если есть
        if (folder.startsWith('/')) folder = folder.substring(1);
        // Добавляем завершающий слеш, если его нет
        if (!folder.endsWith('/')) folder += '/';
    }

    const format = formatSelect.value;

    if (!filename) {
        showUploadError('Не указано имя файла', 'Введите имя файла для сохранения');
        return;
    }

    // Добавляем timestamp
    if (addTimestamp.checked) {
        const timestamp = new Date()
            .toLocaleString('en-CA', {
                timeZone: 'Asia/Yekaterinburg',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
            .replace(/,/g, '')
            .replace(/\s/g, '_')
            .replace(/:/g, '-');
        filename = `${filename}_${timestamp}_${format}`;
    } else {
        filename = `${filename}_${format}`;
    }

    // Полный путь на сервере
    const fullPath = folder + filename;

    showUploadProgress();
    updateUploadProgress(10, 'Подготовка изображения...');

    const uploadButton = document.getElementById('uploadButton');
    const cancelButton = document.getElementById('cancelButton');
    if (uploadButton) uploadButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

// Имитация задержки для плавности интерфейса (500 мс)
setTimeout(() => {

    // Обновляем прогресс на 30% с указанием формата
    updateUploadProgress(30, 'Конвертация в формат ' + format.toUpperCase() + '...');

    // Создаём объект FormData для отправки файла
    const formData = new FormData();
    const width = file.matrix.length;
    const height = file.matrix[0].length;

    // Добавляем поля
    formData.append('filename', filename);
    formData.append('autoscale', file.autoscale);
    formData.append('colormap', file.colormap);
    formData.append('width', width);
    formData.append('height', height);
    formData.append('minValue', file.minValue);
    formData.append('maxValue', file.maxValue);

    // Если matrix — это TypedArray (например, Uint8Array), конвертируем в Blob
    const matrixBlob = new Blob([file.matrix], { type: 'application/octet-stream' });
    formData.append('matrix', matrixBlob, 'matrix.tpt'); // 'matrix.tpt' — имя файла для серверной обработки
    
    updateUploadProgress(50, 'Отправка на сервер...');

    // Отправка
    fetch('/upload_minio', {
        method: 'POST',
        body: formData // Не указываем headers, браузер сам добавит 'Content-Type: multipart/form-data'
    })
    .then(response => {
        updateUploadProgress(75, 'Обработка на сервере...');
        return response.json();
    })
    .then(data => {
        if (data.success) {
            updateUploadProgress(100, '✅ Загрузка завершена!');     
            // Автоматическое закрытие через 3 сек (как и раньше)
            setTimeout(() => {
                closeFilenameModal();
                resetUploadModal();
            }, 3000);
        } else {
            throw new Error(data.error || 'Сервер не принял файл');
        }
    })
    .catch(error => {
        console.error('Ошибка загрузки:', error);
        showUploadError('Ошибка загрузки', error.message);
        resetUploadButtons();
    });
}, 500); // Задержка перед началом конвертации для плавности
}

// Новые функции для управления индикатором загрузки
function showUploadProgress() {
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadResult = document.getElementById('uploadResult');
    const uploadError = document.getElementById('uploadError');
    
    if (uploadStatus) uploadStatus.style.display = 'block';
    if (uploadResult) uploadResult.style.display = 'none';
    if (uploadError) uploadError.style.display = 'none';
}
function updateUploadProgress(percent, message) {
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    const progressMessage = document.getElementById('uploadMessage');
    
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = percent + '%';
    if (progressMessage) progressMessage.textContent = message;
}

function showUploadSuccess(data) {
    hideUploadProgress();
    const uploadResult = document.getElementById('uploadResult');
    const resultMessage = document.getElementById('resultMessage');
    const resultDetails = document.getElementById('resultDetails');
    
    if (uploadResult) uploadResult.style.display = 'block';
    if (resultMessage) resultMessage.textContent = 'Изображение успешно сохранено!';
    if (resultDetails) {
        resultDetails.innerHTML = `
            Файл: <strong>${data.original_filename}</strong><br>
            На сервере: <strong>${data.filename}</strong><br>
            <button onclick="closeFilenameModal(); loadServerFileList();" 
                    style="margin-top:5px; padding:3px 8px; font-size:10px; background:#4CAF50; color:white; border:none; border-radius:3px; cursor:pointer;">
                <i class="fas fa-sync-alt"></i> Обновить список
            </button>
        `;
    }
}

function showUploadError(title, details) {
    hideUploadProgress();
    const uploadError = document.getElementById('uploadError');
    const errorMessage = document.getElementById('errorMessage');
    const errorDetails = document.getElementById('errorDetails');
    
    if (uploadError) uploadError.style.display = 'block';
    if (errorMessage) errorMessage.textContent = title;
    if (errorDetails) errorDetails.textContent = details;
    resetUploadButtons();
}

// Функции для сообщений и удаления (остаются без изменений)
function showLoadMessage(text, type = 'info') {
    const messageDiv = document.getElementById('loadServerMessage');
    const messageText = document.getElementById('loadServerMessageText');
    
    if (!messageDiv || !messageText) return;
    
    messageText.textContent = text;
    messageDiv.style.display = 'block';
    messageDiv.style.padding = '8px';
    messageDiv.style.borderRadius = '3px';
    
    switch(type) {
        case 'success':
            messageDiv.style.backgroundColor = '#e8f5e8';
            messageDiv.style.border = '1px solid #4CAF50';
            messageDiv.style.color = '#2e7d32';
            break;
        case 'error':
            messageDiv.style.backgroundColor = '#ffebee';
            messageDiv.style.border = '1px solid #f44336';
            messageDiv.style.color = '#c62828';
            break;
        case 'warning':
            messageDiv.style.backgroundColor = '#fff3e0';
            messageDiv.style.border = '1px solid #ff9800';
            messageDiv.style.color = '#ef6c00';
            break;
        default:
            messageDiv.style.backgroundColor = '#e3f2fd';
            messageDiv.style.border = '1px solid #2196f3';
            messageDiv.style.color = '#1565c0';
    }
}

// Выделить элемент в панели (клик)
function selectItem(panel, fullPath, isFolder, displayName) {
    // Снимаем выделение в другой панели и устанавливаем в текущей
    if (panel === 'left') {
        if (selectedLeftItem && selectedLeftItem.fullPath === fullPath) {
            // Если кликнули на уже выделенный – можно снять выделение (опционально)
            selectedLeftItem = null;
        } else {
            selectedLeftItem = { fullPath, isFolder, displayName };
        }
        selectedRightItem = null;
        activePanel = 'left';
    } else {
        if (selectedRightItem && selectedRightItem.fullPath === fullPath) {
            selectedRightItem = null;
        } else {
            selectedRightItem = { fullPath, isFolder, displayName };
        }
        selectedLeftItem = null;
        activePanel = 'right';
    }
    // Перерисовываем обе панели для обновления класса selected-row
    refreshBothPanels();
    updateActivePanelHighlight(); // <-- добавить здесь
}
function refreshBothPanels() {
    loadPanelList('left');
    loadPanelList('right');
}

// Функция загрузки файла с сервера (используем полный путь)
function loadImageFromServer(filePath) {
    showLoadMessage(`Загрузка изображения...`, 'info');

    // fetch(`/download_minio/${encodeURIComponent(filePath)}`)
    //     .then(response => {
    //         if (!response.ok) throw new Error('Ошибка загрузки');
    //         return response.json();
    //     })
    //     .then(data => {
    //         // Здесь data – вероятно, объект с matrix, width, height, min_value, max_value
    //         const numbers = data.matrix.split(',').map(num => parseFloat(num.trim()));
    //         const rows = data.width;
    //         const cols = data.height;
    //         const matrix = [];
    //         for (let i = 0; i < rows; i++) {
    //             matrix.push(numbers.slice(i * cols, (i + 1) * cols));
    //         }

    //         createFileFromImageData(data.filename || filePath.split('/').pop(),
    //             matrix,
    //             data.width,
    //             data.height,
    //             data.min_value,
    //             data.max_value
    //         );
    //         closeLoadFromServerModal();
    //         showLoadMessage(`Изображение загружено`, 'success');
    //         setTimeout(hideLoadMessage, 2000);
    //     })
    //     .catch(error => {
    //         console.error('Ошибка загрузки:', error);
    //         showLoadMessage(`Ошибка: ${error.message}`, 'error');
    //     });
    console.log(filePath)
    fetch(`/download_minio/${filePath}`)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки');
            return response.json(); // Парсинг JSON
        })
        .then(blob => {
            const numbers = blob.matrix.split(',').map(num => parseFloat(num.trim()));
            const cols = blob.width; // Количество строк в матрице (подставь нужное значение)
            const rows = blob.height; // Количество столбцов

            const matrix = [];
            for (let i = 0; i < cols; i++) {
                matrix.push(numbers.slice(i * rows, (i + 1) * rows));
            }

    
            createFileFromImageData(blob.filename, 
                matrix, 
                blob.height, 
                blob.width, 
                blob.min_value, 
                blob.max_value,
                254
            );



            closeLoadFromServerModal();
            showLoadMessage(`Изображение загружено`, 'success');
            setTimeout(hideLoadMessage, 2000);
        })
       
        .catch(error => {
            console.error('Ошибка загрузки:', error);
            showLoadMessage(`Ошибка: ${error.message}`, 'error');
        });
}

// Перейти в папку (двойной клик)
function navigatePanel(panel, folderPath) {
    if (panel === 'left') {
        leftPanelPath = folderPath;
        loadPanelList('left');
        updateActivePanelHighlight(); // <-- добавить здесь
    } else {
        rightPanelPath = folderPath;
        loadPanelList('right');
        updateActivePanelHighlight(); // <-- добавить здесь
    }
    // Сбрасываем выделение в этой панели
    if (panel === 'left') selectedLeftItem = null;
    else selectedRightItem = null;
}

// Переход на уровень выше в указанной панели
function navigateUp(panel) {
    let currentPath = panel === 'left' ? leftPanelPath : rightPanelPath;
    if (currentPath === '/') return;

    // Убираем завершающий слеш и находим родительский путь
    let cleanPath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
    const lastSlash = cleanPath.lastIndexOf('/');
    let parentPath;
    if (lastSlash === -1) {
        parentPath = '/';
    } else {
        parentPath = cleanPath.substring(0, lastSlash + 1); // сохраняем слеш в конце
    }

    // Обновляем путь панели и перезагружаем список
    if (panel === 'left') {
        leftPanelPath = parentPath;
        loadPanelList('left');
        selectedLeftItem = null; // сбрасываем выделение
    } else {
        rightPanelPath = parentPath;
        loadPanelList('right');
        selectedRightItem = null;
    }
}

// Скачать файл по прямому пути (двойной клик)
function downloadFile(fullPath) {
    const url = `/download_minio/${encodeURIComponent(fullPath)}`;
    window.open(url, '_blank');
}

function closeLoadFromServerModal() {
    const modal = document.getElementById('loadFromServerModal');
    if (modal) modal.classList.remove('active');
}

function hideLoadMessage() {
    const messageDiv = document.getElementById('loadServerMessage');
    if (messageDiv) messageDiv.style.display = 'none';
}


function formatFileSize(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- Действия с выделенным элементом (кнопки снизу) ---

function createFolderInActivePanel() {
    const folderName = prompt('Введите имя новой папки:');
    if (!folderName) return;
    const currentPath = activePanel === 'left' ? leftPanelPath : rightPanelPath;
    const safeName = folderName.replace(/[\/\\:*?"<>|]/g, '_');
    if (safeName !== folderName) {
        if (!confirm(`Имя содержит недопустимые символы (\\ / : * ? " < > |). Будет использовано "${safeName}". Продолжить?`)) {
            return;
        }
    }
    const folderPath = currentPath === '/' ? safeName + '/' : currentPath + safeName + '/';
    fetch('/mkdir_minio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: folderPath })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            refreshBothPanels();
        } else {
            alert('Ошибка создания папки: ' + (data.error || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка создания папки:', error);
        alert('Ошибка соединения с сервером');
    });
}
function deleteSelectedInActivePanel() {
    const selected = activePanel === 'left' ? selectedLeftItem : selectedRightItem;
    if (!selected) {
        alert('Не выбран файл или папка для удаления');
        return;
    }
    const type = selected.isFolder ? 'папку' : 'файл';
    if (!confirm(`Удалить ${type} "${selected.displayName}"?`)) return;

    fetch(`/delete_minio?path=${encodeURIComponent(selected.fullPath)}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            refreshBothPanels();
        } else {
            alert('Ошибка удаления: ' + (data.error || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка удаления:', error);
        alert('Ошибка соединения с сервером');
    });
}

function downloadSelectedInActivePanel() {
    const selected = activePanel === 'left' ? selectedLeftItem : selectedRightItem;
    if (!selected) {
        alert('Не выбран файл для скачивания');
        return;
    }
    if (selected.isFolder) {
        alert('Папку нельзя скачать одним файлом');
        return;
    }
    downloadFile(selected.fullPath);
}

function moveSelectedToOtherPanel() {
    const sourcePanel = activePanel;
    const targetPanel = sourcePanel === 'left' ? 'right' : 'left';

    const selected = sourcePanel === 'left' ? selectedLeftItem : selectedRightItem;
    if (!selected) {
        alert('Не выбран файл или папка для перемещения');
        return;
    }
    if (selected.isFolder) {
        alert('Перемещение папок пока не поддерживается (можно перемещать только файлы)');
        return;
    }

    const targetPath = targetPanel === 'left' ? leftPanelPath : rightPanelPath;
    let destination;
    if (targetPath === '/') {
        destination = selected.displayName;
    } else {
        destination = targetPath + (targetPath.endsWith('/') ? '' : '/') + selected.displayName;
    }

    if (!confirm(`Переместить "${selected.displayName}" в папку "${targetPath}"?`)) return;

    fetch('/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: selected.fullPath, destination })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            refreshBothPanels();
        } else {
            alert('Ошибка перемещения: ' + (data.error || 'Неизвестная ошибка'));
        }
    })
    .catch(error => {
        console.error('Ошибка перемещения:', error);
        alert('Ошибка соединения с сервером');
    });
}


console.log('✅ Wtis server.js загружен');