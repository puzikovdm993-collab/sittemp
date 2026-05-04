// ============ Система управления файлами через выпадающий список ============
// import { handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick } from '/src/events/events.js'; // Абсолютный путь (лучше)
// import { getColormap } from '/src/imageOps/imageOps.js'; // Абсолютный путь (лучше)
// import { resetHistory, pushState } from '/src/history/history.js'; // Абсолютный путь (лучше)

// Функция для обновления заголовка окна
function updateWindowTitle() {
    const file = getActiveFile();
    if (file && dom.windowTitle) {
        dom.windowTitle.textContent = `${file.filename} - Paint`;
    }
}

// Функция для обновления метки текущего файла в Ribbon
function updateCurrentFileLabel() {
    const file = getActiveFile();
    const label = document.getElementById('currentFileLabel');
    if (file && label) {
        label.textContent = file.filename || 'Безымянный';
    }
}

// Генерация уникального ID
function makeId() {
    try {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {}
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

// Получение файла по ID
function getFile(fileId) {
    return project.files.find(f => f.id === fileId) || null;
    //return openFiles.find(f => f.id === fileId) || null;
}

// Получение активного файла
function getActiveFile() {
    return getFile(activeFileId);
}

// Экспорт функции для использования в других модулях
window.getActiveFile = getActiveFile;

// Переключение на файл
function switchToFile(fileId) {
    const file = getFile(fileId);
    if (!file) return;

    project.files.forEach(f => {  
        if (f.canvas) {
            f.canvas.style.display = 'none';
        }
    });
    
    // Показываем активный canvas
    if (file.canvas) {
        file.canvas.style.display = 'block';
    }
    
    // Устанавливаем активный файл
    activeFileId = fileId;



    const max = document.getElementById('color_bar_label_max');
    const median = document.getElementById('color_bar_label_median');
    const min = document.getElementById('color_bar_label_min');

    max.textContent = file.maxValue;
    median.textContent = ((file.maxValue+file.minValue)/2).toFixed(5);
    min.textContent = file.minValue;

    canvas = file.canvas;
    ctx = file.ctx;
    
    // Обновляем интерфейс
    updateWindowTitle();        // Функция для обновления заголовка окна
    updateCurrentFileLabel();   // Функция для обновления метки текущего файла в Ribbon
    updateCanvasSize();         // Управление холстом
    applyZoom();
    setCanvasCursor();
    
    // Обновляем список открытых файлов
    updateOpenFilesList();              // Обновление списка открытых файлов в выпадающем списке
    updateActiveFilePreview(fileId);
}

// Закрытие файла
function closeFile(fileId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    //if (openFiles.length <= 1) {
    if (project.files.length <= 1) {
        alert('Нельзя закрыть единственный файл!');
        return;
    }
    
    const file = getFile(fileId);
    if (!file) return;
    
    // const fileIndex = openFiles.findIndex(f => f.id === fileId);
    const fileIndex = getFile(fileId)

    // Удаление DOM элементов
    if (file.canvas) {
        file.canvas.remove();
    }
    
    // openFiles.splice(fileIndex, 1);
    project.files.splice(fileIndex, 1);
    
    // Переключение на соседний файл
    if (activeFileId === fileId) {
        // const nextFile = openFiles[Math.max(0, fileIndex - 1)] || openFiles[0];
        const nextFile = project.files[Math.max(0, fileIndex - 1)] || project.files[0];
        if (nextFile) {
            switchToFile(nextFile.id);
        }
    }
    
    updateOpenFilesList();
}

// Обновление превью файлов
function updateFileThumbnails() {
    //openFiles.forEach(file => {
    project.files.forEach(file => {
        updateFileThumbnail(file.id);
        //updateActiveFilePreview(file.id);
    });
}

// Создание превью для файла
function updateFileThumbnail(fileId) {
    const file = getFile(fileId);
    if (!file || !file.canvas) return;
    
    const thumbCanvas = document.getElementById(`thumb-canvas-${fileId}`);
    const thumbImg = document.getElementById(`thumb-img-${fileId}`);
    
    if (!thumbCanvas || !thumbImg) return;
    
    try {
        const ctx = thumbCanvas.getContext('2d');
        
        // Очищаем превью
        ctx.clearRect(0, 0, 40, 40);
        
        // Рисуем белый фон
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 40, 40);
        
        // Масштабируем и рисуем изображение
        const scale = Math.min(40 / file.canvas.width, 40 / file.canvas.height);
        const x = (40 - file.canvas.width * scale) / 2;
        const y = (40 - file.canvas.height * scale) / 2;
        
        ctx.drawImage(file.canvas, x, y, file.canvas.width * scale, file.canvas.height * scale);
        
        // Конвертируем в data URL для img
        thumbImg.src = thumbCanvas.toDataURL();
    } catch (e) {
        console.error('Ошибка создания превью:', e);
    }
}

// Обновление списка открытых файлов в выпадающем списке
function updateOpenFilesList() {
    const filesList = document.getElementById('openFilesList');
    if (!filesList) return;
    
    
    if (project.files.length === 0) {
    //if (openFiles.length === 0) {
        filesList.innerHTML = `
            <div class="no-files-message">
                <i class="fas fa-image"></i>
                <div>Нет открытых файлов</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    //openFiles.forEach(file => {
    project.files.forEach(file => {
        const isActive = file.id === activeFileId;
        const filename = file.filename || 'Безымянный';
        const dimensions = file.canvas ? `${file.canvas.width} × ${file.canvas.height}` : '—';
        
        html += `
            <div class="open-file-item ${isActive ? 'active' : ''}" 
                 onclick="switchToFile('${file.id}'); closeOpenFilesDropdown();">
                <div class="file-preview">
                    <canvas id="thumb-canvas-${file.id}" width="40" height="40" 
                            style="display: none;"></canvas>
                    <img id="thumb-img-${file.id}" class="file-thumbnail" 
                         alt="${filename}" width="40" height="40">
                </div>
                <div class="file-info">
                    <div class="file-name" title="${filename}">${filename}</div>
                    <div class="file-details">${dimensions}</div>
                </div>
                <button class="file-close-btn" onclick="closeFile('${file.id}', event)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    filesList.innerHTML = html;
    document.getElementById("currentFileLabel").style.display = "none";
    //document.getElementById("fileCountBadge").textContent = openFiles.length;
    document.getElementById("fileCountBadge").textContent = project.files.length;

    //document.getElementById("fileCountBadge").innerHTML = 2;
    // Обновляем превью для каждого файла
    updateFileThumbnails();

        // Обновляем состояние кнопок (активные/неактивные)
        updateButtonsState();

}

function updateActiveFilePreview(fileId) {
    const file = getFile(fileId);
    const canvas = document.getElementById('activeFileThumbCanvas');
    const img = document.getElementById('activeFileThumbImg');
    const label = document.getElementById('currentFileLabel');

    // Очищаем предыдущие превью
    canvas.style.display = 'none';
    img.style.display = 'none';
    label.textContent = file?.filename || 'Безымянный';

    // Если файл имеет холст (например, изображение), генерируем миниатюру
    if (file?.canvas) {
        canvas.style.display = 'inline-block'; // Показываем canvas
        const ctx = canvas.getContext('2d');
        
        // Очищаем превью
        ctx.clearRect(0, 0, 32, 32);
        
        // Рисуем белый фон
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 32, 32);
        
        // Масштабируем и рисуем изображение
        const scale = Math.min(32 / file.canvas.width, 32 / file.canvas.height);
        const x = (32 - file.canvas.width * scale) / 2;
        const y = (32 - file.canvas.height * scale) / 2;
        
        ctx.drawImage(file.canvas, x, y, file.canvas.width * scale, file.canvas.height * scale);
        
        // Конвертируем в data URL для img
        img.src = canvas.toDataURL();
    } 
    // Если есть готовое превью (например, URL)
    else if (file?.thumbnailUrl) {
        img.src = currentFile.thumbnailUrl;
        img.alt = currentFile.filename || 'Превью';
        img.style.display = 'inline-block'; // Показываем img
    }
    // Если нет превью — показываем текст
    else {
        label.textContent = file?.filename || 'Безымянный';
    }

}

// Переключение выпадающего списка открытых файлов
function toggleOpenFilesDropdown() {
    const dropdown = document.getElementById('openFilesDropdown');
    if (!dropdown) return;
    
    const isShowing = dropdown.classList.contains('show');
    
    // Закрываем другие выпадающие списки
    closeAllDropdowns();
    
    if (isShowing) {
        closeOpenFilesDropdown();
    } else {
        openOpenFilesDropdown();
    }
}

// Открытие выпадающего списка
function openOpenFilesDropdown() {
    const dropdown = document.getElementById('openFilesDropdown');
    if (!dropdown) return;
    
    dropdown.classList.add('show');
    
    // Обновляем список файлов при открытии
    updateOpenFilesList();
}

// Закрытие выпадающего списка
function closeOpenFilesDropdown() {
    const dropdown = document.getElementById('openFilesDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Закрытие всех выпадающих списков
function closeAllDropdowns() {
    closeOpenFilesDropdown();
    if (dom.shapesPanel) {
        dom.shapesPanel.classList.remove('active');
    }
}

// Функция для переключения файлов по Ctrl+Tab
function cycleThroughFiles() {
    if (openFiles.length <= 1) return;
    
    const currentIndex = openFiles.findIndex(f => f.id === activeFileId);
    const nextIndex = (currentIndex + 1) % openFiles.length;
    switchToFile(openFiles[nextIndex].id);
}

// Привязка обработчиков событий к canvas
function attachCanvasEvents(cnv) {
    cnv.addEventListener('mousedown', handleMouseDown);
    cnv.addEventListener('mousemove', handleMouseMove);
    cnv.addEventListener('mouseup', handleMouseUp);
    cnv.addEventListener('mouseleave', handleMouseUp);
    cnv.addEventListener('dblclick', handleDoubleClick);
    cnv.addEventListener('contextmenu', handleCanvasContextMenu);
}

// Добавляем обработчик контекстного меню на canvasArea для работы правого клика во всей области
function attachCanvasHostEvents() {
    const host = document.getElementById('canvasArea');
    if (host) {
        host.addEventListener('contextmenu', (e) => {
            // Если клик был по canvas, то событие уже обработано attachCanvasEvents
            if (e.target.tagName === 'CANVAS') return;
            handleCanvasContextMenu(e);
        });
    }
}

// function newImage()                         // создаёт новый пустой файл
// function loadImage(event)                   // загружает изображение из файла
// function clearCanvas()                      // очищает холст



// run
document.getElementById('run').onclick = async () => {
    console.log('Вызвана функция document.getElementById(\'run\').onclick = async () => { ');
    const btn = document.getElementById('run');
    btn.classList.add('running');
    btn.disabled = true;
    try {
        // Создаём промис для асинхронной загрузки файла
        await new Promise((resolve, reject) => {

            // Создаём элемент <input type="file"> и настраиваем его:
            // Создаём HTML-инпут
            const input = document.createElement('input');
            // Указываем тип как "файл"
            input.type = 'file';
            // Разрешаем только файлы с расширением .tpt
            input.accept = '.tpt';
            // Обрабатываем выбор файла пользователем
            input.onchange = async (e) => {
                // Получаем первый выбранный файл
                const file = e.target.files[0];
                // Если файл не выбран
                if (!file) {
                    // Отклоняем промис с ошибкой
                    reject('Файл не выбран');
                    // Прерываем выполнение
                    return;
                }

                //Проверяем расширение файла:
                const filenameParts = file.name.split('.'); // Разделяем по точке (например, "data.tpt" → ["data", "tpt"])
                const filename = filenameParts.slice(0, -1).join('.'); // Базовое имя без расширения (["data"] → "data")
                const fileExtension = filenameParts.pop().toLowerCase() || 'unknown'; // Получаем расширение в нижнем регистре (["tpt"] → "tpt")
                if (fileExtension !== 'tpt') {
                    reject('Файл должен иметь расширение .tpt');
                    return;
                }

                // Создаём FileReader для чтения содержимого файла:
                const reader = new FileReader();

                // Обработчик ошибок чтения файла (например, CORS или повреждение):
                reader.onerror = (err) => {
                    // Логируем тип ошибки (например, "NOT_READABLE_ERROR")
                    console.error('Ошибка чтения файла:', err.target.error);
                    // Передаём сообщение об ошибке
                    reject('Ошибка чтения файла: ' + err.target.error.message);
                };

                // Обработчик успешного чтения файла (содержимое доступно в ev.target.result):
                reader.onload = (ev) => {

                    // Обрабатываем строки файла:
                    const lines = ev.target.result.split('\n')  // Разбиваем текст по строкам
                        .map(line => line.trim())               // Удаляем лишние пробелы в начале/конце
                        .filter(line => line !== '');           // Оставляем только непустые строки
                    
                    // Проверяем минимальное количество строк (должно быть ≥ 3: width, height, matrix):
                    if (lines.length < 3) {
                        reject('Файл .tpt должен содержать минимум 3 строки: width, height, matrix');
                        return;
                    }


                    // Парсим ширину и высоту матрицы:
                    // Первая строка — либо DPI, либо высота
                    const firstLine = lines[0]?.trim() || '';
                    const widthLine = firstLine.startsWith('#DPI=') ? lines[1] : lines[0];
                    const heightLine = firstLine.startsWith('#DPI=') ? lines[2] : lines[1];
                    const dpiLine = firstLine.startsWith('#DPI=') ? lines[0] : '#DPI=254';

                    // Извлекаем ширину и высоту
                    const dpi =  parseFloat(dpiLine.split('=')[1]);
                    const height = parseInt(widthLine, 10);
                    const width = parseInt(heightLine, 10);

                    console.log('dpi = '+ dpi);
                    console.log('width = '+ width);
                    console.log('height = '+ height);
                    // Проверяем корректность чисел
                    if (isNaN(width) || isNaN(height)) {
                        reject('Ширина и высота должны быть числами');
                        return;
                    }

                    // Создаем матрицу — пропускаем строки с DPI (если есть)
                    const matrixStartIndex = firstLine.startsWith('#DPI=') ? 3 : 2;
                    const matrix = lines.slice(matrixStartIndex).map(line => 
                        line.trim() 
                            .split(/\s+/) 
                            .filter(token => !token.startsWith('#DPI=')) // Доп. защита от случайных DPI в матрице
                            .map(Number)
                    );

                    // Проверяем соответствие количества строк матрицы заявленному height:
                    if (matrix.length !== height) {
                        reject(`Ожидалось ${height} строк матрицы, найдено ${matrix.length}`);
                        return;
                    }

                    // Проверяем, что все строки матрицы имеют одинаковую ширину (width):
                    if (matrix.some(row => row.length !== width)) {
                        reject(`Все строки матрицы должны содержать ${width} чисел`);
                        return;
                    }

                    // Ограничение на размер матрицы (максимум 5000x5000 элементов):
                    // if (width * height > 25_000_000) {
                    //     reject('Матрица слишком большая (максимум 25 000 000 элементов)');
                    //     return;
                    // }

                    // Находим минимальное и максимальное значения в матрице:
                    let minVal = Infinity, maxVal = -Infinity;  // Инициализация
                    for (let y = 0; y < height; y++) {          // Проходим по строкам
                        for (let x = 0; x < width; x++) {       // Проходим по столбцам
                            const val = matrix[y][x];           // Текущее значение
                            if (val < minVal) minVal = val;     // Обновляем минимум
                            if (val > maxVal) maxVal = val;     // Обновляем максимум
                        }
                    }

                    // Создаем файл из ImageData
                    createFileFromImageData(filename, matrix, width, height, minVal, maxVal, dpi);

                    // Сохраняем файл в недавние
                    addToRecentFiles({
                        name: file.name,
                        lastModified: file.lastModified,
                        size: file.size,
                        type: file.type
                        //data: e.target.result // Сохраняем данные для быстрого открытия
                    });

                    // Завершаем промис (успешное выполнение):
                    resolve();
                };

                // Альтернативный обработчик ошибок:
                reader.onerror = () => reject('Ошибка чтения файла');
                // Начинаем чтение файла как текста:
                reader.readAsText(file);
            };
            // Принудительно открываем диалог выбора файла:
            input.click();
        });
    } catch (err) {
        alert(`Ошибка: ${err}`);
    } finally {
        btn.classList.remove('running');
        btn.disabled = false;
    }
};

// Создание файла из ImageData
function createFileFromImageData(filename, matrix, width, height, minValue, maxValue,dpi) {
    const id = makeId();

    // Создаем canvas элемент
    const cnv = document.createElement('canvas');
    cnv.className = 'paint-canvas';
    cnv.id = `canvas-${id}`;
    cnv.width = width;
    cnv.height = height;
    cnv.style.display = 'none';

    attachCanvasEvents(cnv);
    dom.canvasHost.appendChild(cnv);
    


    // Рисуем ImageData на canvas
    const colorBar = document.getElementById('colorBar');
    //console.log(colorBar.classList[1]);

    const colorBarNames = {
        'color-bar-gray': 'gray',
        'color-bar-plasma': 'plasma',
        'color-bar-inferno': 'inferno',
        'color-bar-magma': 'magma',
        'color-bar-cividis': 'cividis',
        'color-bar-rainbow': 'rainbow',
        'color-bar-coolwarm': 'coolwarm'       
    };
    //console.log(colorBarNames[colorBar.classList[1]]);
    const autoscale = true;
    const colormap = colorBarNames[colorBar.classList[1]];
    //console.log(colormap);
    const colorMap = getColormap(colormap);
    const data = new Uint8ClampedArray(width * height * 4);
    let dataIndex = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const normalizedValue = (matrix[y][x] - minValue) / (maxValue - minValue + 1e-9) ;
            
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

    // console.log(maxValue);
    // const lnormalizedValue = (maxValue - minValue) / (maxValue - minValue + 1e-9);
    // const lcolor = getGradientColor(Math.max(0, Math.min(1, lnormalizedValue)));
    // //const lcolor = colorMap(Math.max(0, Math.min(1, lnormalizedValue)));

    // console.log('Math.max(0, Math.min(1, lnormalizedValue)) = ' +Math.max(0, Math.min(1, lnormalizedValue)));
    // console.log('lnormalizedValue = ' +lnormalizedValue);
    // console.log('lcolor = '+lcolor);

    // console.log('lcolor.r = ' + lcolor.r * 255);
    // console.log('lcolor.g = ' + lcolor.g * 255);
    // console.log('lcolor.b = ' + lcolor.b * 255);




    // const canvas = document.createElement('canvas');
    // canvas.width = width;
    // canvas.height = height;

    const imageData = new ImageData(data, width, height);



    const file = {
        id: id,
        filename: filename || 'UnownName',
        matrix:matrix,
        minValue: minValue,
        maxValue: maxValue,
        height: height,
        width: width,
        dpi:dpi,
        autoscale:true,
        colormap:colormap,
        canvas: cnv,
        ctx: cnv.getContext('2d', { willReadFrequently: true }),
        history: [],
        historyIndex: -1,
        selection: []
    };



    file.ctx.putImageData(imageData, 0, 0);
    file.matrix = matrix;
    file.minValue = minValue;
    file.maxValue = maxValue;
    resetHistory(file);
    pushState(file);

    //project.addFile(file);
    project.files.push(file);
   
    switchToFile(id);
    updateOpenFilesList();
    return file;
}

// Применение сохраннеия
function applySave() {
    const file = getActiveFile();
    if (!file) return;

    const filename = document.getElementById("saveName").value;
    const format = document.getElementById("saveFormat").value;

    if(format == "tpt"){
        saveToTptFile(file,filename)
        .then(message => console.log(message))
        .catch(error => console.error(error));
    }
    else   {
        const link = document.createElement('a');
        const base = file.filename.replace(/\.(png|jpg|jpeg)$/i, '');
        link.download = `${base}.${format}`;
        link.href = file.canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        link.click();
    }

    if (file.id === activeFileId) {
        //console.log('if (file.id === activeFileId) { (разкоментируй)')
        canvas = file.canvas;
        ctx = file.ctx;
        applyZoom();
        updateCanvasSize();
    }

    saveState();

    closeSaveModal();
}

// Сохранение файла .tpt
function saveToTptFile(file, filename = null) {
    return new Promise((resolve, reject) => {
        try {
            const dpi = file.dpi;
            const width = file.matrix.length;
            const height = file.matrix[0].length;
            
            const data = file.matrix;

            // Если filename не указан, используем оригинальный или генерируем новый
            const outputFilename = filename+'.tpt' || originalFilename || `matrix_${Date.now()}.tpt`;

            // Формируем строки файла
            const header = `#DPI=${dpi}\n${height}\n${width}\n`;
            const matrixLines = data.map(row => 
                row.map(val => val.toString()).join('\t') // Числа разделены табуляцией (можно заменить на пробел)
            ).join('\n');
            
            // Объединяем заголовок и матрицу
            const fileContent = header + matrixLines;
            
            // Создаём Blob (UTF-8 текст)
            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            
            // Сохраняем файл (используем FileSaver.js или нативный способ)
            if (typeof saveAs === 'function') {
                // Если доступна библиотека FileSaver.js
                saveAs(blob, outputFilename);
            } else {
                // Альтернативный способ (без FileSaver.js)
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = outputFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            // /resolve(`Файл "${outputFilename}" успешно сохранён!`);
        } catch (error) {
            reject(`Ошибка сохранения файла: ${error.message}`);
        }
    });
}

function matrixToImage(){

    const file = getActiveFile();
    if (!file) return;

    // Рисуем ImageData на canvas
    const colorBar = document.getElementById('colorBar');
    const colorBarNames = {
        'color-bar-gray': 'gray',
        'color-bar-plasma': 'plasma',
        'color-bar-inferno': 'inferno',
        'color-bar-magma': 'magma',
        'color-bar-cividis': 'cividis',
        'color-bar-rainbow': 'rainbow',
        'color-bar-coolwarm': 'coolwarm'       
    };

    const colormap = colorBarNames[colorBar.classList[1]];
    const colorMap = getColormap(colormap);
    const data = new Uint8ClampedArray(file.width * file.height * 4);
    let dataIndex = 0;
    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {
            const normalizedValue = (file.matrix[y][x] - file.minValue) / (file.maxValue - file.minValue + 1e-9) ;
            
            const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));

            data[dataIndex++] = color.r;
            data[dataIndex++] = color.g;
            data[dataIndex++] = color.b;
            data[dataIndex++] = 255;
        }
    }
    const imageData = new ImageData(data, file.width, file.height);

       // Создаем временный canvas для исходного ImageData
       const tempCanvas = document.createElement('canvas');
       const tempCtx = tempCanvas.getContext('2d');
       tempCanvas.width = file.width;
       tempCanvas.height = file.height;

        tempCtx.putImageData(imageData, 0, 0); // Полное копирование ImageData
        file.canvas.width = tempCanvas.width;
        file.canvas.height = tempCanvas.height;

        file.ctx = file.canvas.getContext('2d', { willReadFrequently: true });
        file.ctx.drawImage(tempCanvas, 0, 0);


        if (file.id === activeFileId) {
            canvas = file.canvas;
            ctx = file.ctx;
            applyZoom();
            updateCanvasSize();
        }

    //saveState();
    return file;
}
// Вырезано из PAINT
// // Создание нового пустого файла
// function createBlankFile(filename) {
//     const id = makeId();
//     const file = {
//         id: id,
//         filename: filename || 'Безымянный',
//         canvas: null,
//         ctx: null,
//         history: [],
//         historyIndex: -1
//     };
//     // Создаем canvas элемент
//     const cnv = document.createElement('canvas');
//     cnv.className = 'paint-canvas';
//     cnv.id = `canvas-${id}`;
//     cnv.width = 800;
//     cnv.height = 600;
//     // Скрываем все canvas кроме активного
//     if (openFiles.length > 0) {
//         cnv.style.display = 'none';
//     }
//     attachCanvasEvents(cnv);
//     dom.canvasHost.appendChild(cnv);
//     file.canvas = cnv;
//     file.ctx = cnv.getContext('2d', { willReadFrequently: true });
//     // Заливка белым фоном
//     file.ctx.fillStyle = '#ffffff';
//     file.ctx.fillRect(0, 0, file.canvas.width, file.canvas.height);
//     resetHistory(file);
//     pushState(file);
//     openFiles.push(file);
//     // Если это первый файл, делаем его активным
//     if (openFiles.length === 1) {
//         switchToFile(id);
//     }
//     updateOpenFilesList();
//     return file;
// }


// Вырезано из PAINT
// // Создание файла из загруженного изображения
// function createFileFromImage(filename, img) {
//     const id = makeId();
//     const file = {
//         id: id,
//         filename: filename || 'Изображение',
//         canvas: null,
//         ctx: null,
//         history: [],
//         historyIndex: -1
//     };
//     // Создаем canvas элемент
//     const cnv = document.createElement('canvas');
//     cnv.className = 'paint-canvas';
//     cnv.id = `canvas-${id}`;
//     cnv.width = img.width;
//     cnv.height = img.height;
//     cnv.style.display = 'none';
//     attachCanvasEvents(cnv);
//     dom.canvasHost.appendChild(cnv);
//     file.canvas = cnv;
//     file.ctx = cnv.getContext('2d', { willReadFrequently: true });
//     file.ctx.drawImage(img, 0, 0);
//     resetHistory(file);
//     pushState(file);
//     openFiles.push(file);
//     switchToFile(id);
//     updateOpenFilesList();
//     return file;
// }