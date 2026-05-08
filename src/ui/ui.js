// Обновление интерфейса и модальные окна

// ============ Управление холстом ============
function updateCanvasSize() {
    const file = getActiveFile();
    if (!file || !file.canvas) return;

    if (dom.canvasSize) {
        dom.canvasSize.textContent = `${file.canvas.width} × ${file.canvas.height} пикселей`;
    }
    updateActiveFilePreviewLocal(file.id);
}

function updateActiveFilePreviewLocal(fileId) {
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

// // Получение файла по ID
// function getFileLocal(fileId) {
//     return openFiles.find(f => f.id === fileId) || null;
// }


// ============ Управление масштабом ============
function zoomIn() {
    zoom = Math.min(zoom * 1.2, 32);
    applyZoom();
}

function zoomOut() {
    zoom = Math.max(zoom / 1.2, 0.01);
    applyZoom();
}

function zoomReset() {
    zoom = 1;
    applyZoom();
}
/**
 * Функция applyZoom() применяет масштабирование к активному холсту (canvas).
 * Обновляет размеры холста в DOM и отображает текущий уровень зума.
 */
 function applyZoom() {

    // Получаем текущий активный файл (предположительно, объект с данными изображения)
    const file = getActiveFile();

    // Проверяем, что файл существует
    if (!file){
        // Если условий нет, выходим из функции (зум не применим)
        return;
    }

    // Получаем ссылки на видимые canvas элементы
    const imageCanvas = document.getElementById('imageCanvas');
    const overlayCanvas = document.getElementById('overlayCanvas');

    // Применяем масштабирование к обоим canvas
    if (imageCanvas) {
        imageCanvas.style.width = `${file.width * zoom}px`;
        imageCanvas.style.height = `${file.height * zoom}px`;
    }

    if (overlayCanvas) {
        overlayCanvas.style.width = `${file.width * zoom}px`;
        overlayCanvas.style.height = `${file.height * zoom}px`;
    }

    // Также масштабируем скрытый file.canvas для совместимости
    if (file.canvas) {
        file.canvas.style.width = `${file.width * zoom}px`;
        file.canvas.style.height = `${file.height * zoom}px`;
    }

    // Проверяем, существует ли элемент интерфейса для отображения уровня зума
    if (dom.zoomLevel) {
        // Округляем zoom до целых процентов и обновляем текстовое содержимое элемента
        dom.zoomLevel.textContent = `Масштаб: ${Math.round(zoom * 100)}%`;
        // Пример: если zoom = 1.5, отобразится "150%"
    }
}
// function zoomCustom()

// // Модальное окно изменения размера
// function showResizeModal()
// function closeResizeModal()
// function applyResize()

// Модальные окна загрузки
function showLoadMethodModal() {
    document.getElementById("loadMethodModal").classList.add('active');
}

function closeLoadMethodModal() {
    document.getElementById("loadMethodModal").classList.remove('active');
}

function loadToLocal() {
    closeLoadMethodModal();
    document.getElementById('run').click();
}



// Модальные окна сохранения
function showSaveMethodModal() {
    document.getElementById("saveMethodModal").classList.add('active');
}

function closeSaveMethodModal() {
    document.getElementById("saveMethodModal").classList.remove('active');
}



function saveToLocal() {
    closeSaveMethodModal();
    showSaveModal();
}

function showSaveModal() {
    const file = getActiveFile();
    if (!file) return;
    document.getElementById("saveModal").classList.add('active');
}

// Закрытие модального окна
function closeSaveModal() {
    document.getElementById("saveModal").classList.remove('active');
}



// ============ Медианный фильтр ============
function showMedianModal() {
    const file = getActiveFile();
    if (!file) return;
    document.getElementById('newAperture').value = session.aperture;
    document.getElementById('medianModal').classList.add('active');
}

// Закрытие модального окна
function closeMedianModal() {
    document.getElementById('medianModal').classList.remove('active');
}
// ==========================================


// ============ Нормализация ============
function showNormalisatioModal() {
    const file = getActiveFile();
    if (!file) return;

    const begin = document.getElementById("normalizBegin");
    const end = document.getElementById("normalizEnd");
    begin.value = session.normbegin;
    end.value = session.normend;
    document.getElementById('normalizModal').classList.add('active');
}

// Закрытие Нормализация окна
function closeNormalisatioModal() {
    document.getElementById('normalizModal').classList.remove('active');
}
// ==========================================


// ============ Собель фильтр ============
function showSobelModal() {
}
// Закрытие модального окна
function closeSobelModal() {
}
// ==========================================



// ============ Апроксимация ============
function showApproximationModal() {
    const file = getActiveFile();
    if (!file) return;

    const node_order = document.getElementById("node_order");
    node_order.value = session.node_orderApproximation;
    document.getElementById('approximationModal').classList.add('active');
    
}
// Закрытие модального окна
function closeApproximationModal() {
    document.getElementById('approximationModal').classList.remove('active');
}
// ==========================================

// ============ График ============
// Закрытие модального окна
function closeGraphModal(){
    document.getElementById('graphModal').classList.remove('active')
}
// ==========================================



// ============ Поиск окружности ============
function showRoundSearchingModal() {
    const file = getActiveFile();
    if (!file) return;
    document.getElementById('roundSearchingModal').classList.add('active');
}

//  Закрытие "Поиск окружности" окна
function closeRoundSearchingModal() {
    document.getElementById('roundSearchingModal').classList.remove('active');
}

function showResultRoundSearchingModal() {
    const file = getActiveFile();
    if (!file) return;
    document.getElementById('resultRoundSearchingModal').classList.add('active');
}

//  Закрытие "Поиск окружности" окна
function closeResultRoundSearchingModal() {
    document.getElementById('resultRoundSearchingModal').classList.remove('active');
}
// ==========================================





// ====================== УПРАВЛЕНИЕ ОКНОМ ПРОГРЕССА ======================

let onProgressCancel = null; // колбэк для отмены

/**
 * Показать модальное окно прогресса
 * @param {string} title - заголовок окна
 * @param {boolean} cancellable - показывать ли кнопку "Отмена"
 */
window.showProgressModal = function(title = 'Выполнение операции', cancellable = true) {
    const modal = document.getElementById('progressModal');
    if (!modal) return console.error('progressModal не найден');

    // Сброс значений
    document.getElementById('progressModalTitle').textContent = title;
    document.getElementById('progressMessage').textContent = 'Подготовка...';
    document.getElementById('progressBarFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';

    // Управление кнопкой отмены
    const cancelRow = document.getElementById('progressCancelRow');
    if (cancellable) {
        cancelRow.style.display = 'flex';
    } else {
        cancelRow.style.display = 'none';
    }

    modal.classList.add('active');
};

/**
 * Обновить прогресс
 * @param {number} percent - число от 0 до 100
 * @param {string} message - сообщение о текущем действии
 */
window.updateProgress = function(percent, message) {
    const fill = document.getElementById('progressBarFill');
    const percentSpan = document.getElementById('progressPercent');
    const msgSpan = document.getElementById('progressMessage');

    if (fill) {
        fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
        // Удаляем классы состояний
        fill.classList.remove('complete', 'error');
        // Добавляем класс complete если 100%
        if (percent >= 100) {
            fill.classList.add('complete');
        }
    }
    if (percentSpan) percentSpan.textContent = Math.round(percent) + '%';
    if (msgSpan && message !== undefined) msgSpan.textContent = message;
};

/**
 * Установить статус прогресса (успех/ошибка)
 * @param {string} status - 'complete', 'error' или ''
 * @param {string} message - сообщение для отображения
 */
window.setProgressStatus = function(status, message) {
    const fill = document.getElementById('progressBarFill');
    const msgSpan = document.getElementById('progressMessage');
    
    if (fill) {
        fill.classList.remove('complete', 'error');
        if (status) {
            fill.classList.add(status);
        }
    }
    if (msgSpan && message) {
        msgSpan.textContent = message;
    }
};

/**
 * Закрыть окно прогресса
 */
window.closeProgressModal = function() {
    const modal = document.getElementById('progressModal');
    if (modal) modal.classList.remove('active');
    onProgressCancel = null; // сброс колбэка
};

/**
 * Установить обработчик на кнопку "Отмена"
 * @param {function} callback - функция, вызываемая при отмене
 */
window.setOnProgressCancel = function(callback) {
    onProgressCancel = callback;
};

// Обработчик клика по кнопке "Отмена"
document.getElementById('progressCancelBtn')?.addEventListener('click', () => {
    if (typeof onProgressCancel === 'function') {
        onProgressCancel();
    } else {
        closeProgressModal(); // если колбэка нет, просто закрываем
    }
});





/**
 * Обновление состояния кнопок (делает их неактивными если нет загруженных файлов)
 */
 function updateButtonsState() {
    // const hasFiles = openFiles.length > 0;
    const hasFiles = true;

    // Селекторы для всех кнопок которые должны быть неактивны без файлов
    const buttonsToDisable = document.querySelectorAll(`
        .tab-action-btn:not([onclick*="showLoadMethodModal"]),
        .ribbon-btn:not(#openFilesDropdownBtn)
    `);

    buttonsToDisable.forEach(btn => {
        btn.disabled = !hasFiles;
    });
}




// Заменяем функцию showCodeLab() на обработчик для чекбокса
document.getElementById('colorbarViewToggle')?.addEventListener('change', function() {
    // Предполагаем, что showCodeLab() — это функция, которая управляет отображением
    // Можно оставить её или реализовать логику внутри
    if (this.checked) {
        showCodeLab(); // или ваша логика показа
    } else {
        hideCodeLab(); // или ваша логика скрытия
    }
});

// Если функции showCodeLab() и hideCodeLab() нет, реализуем базовую логику
function showCodeLab() {

    const content = document.getElementById('color_bar_label');
    content.style.display='flex';
    const contents = document.getElementById('colorBar');
    contents.style.display='flex';
}

function hideCodeLab() {
    const content = document.getElementById('color_bar_label');
    content.style.display='none';
    const contents = document.getElementById('colorBar');
    contents.style.display='none';
}

const colorBar = document.getElementById('colorBar');
colorBar.classList.add('color-bar-gray');

document.getElementById('customSelect').addEventListener('change', function() {
    const selectedValue = this.value;
   
    const colorBar = document.getElementById('colorBar');
    const classesToRemove = [
        'color-bar-gray', 
        'color-bar-plasma',
        'color-bar-inferno',
        'color-bar-magma',
        'color-bar-cividis',
        'color-bar-rainbow',
        'color-bar-coolwarm'
    ];

    // Удаляем все активные классы
    classesToRemove.forEach(cls => colorBar.classList.remove(cls));
    
    // Добавляем новый класс в зависимости от выбора
    switch (selectedValue) {
        case 'gray':
            colorBar.classList.add('color-bar-gray');
            break;
        case 'plasma':
            colorBar.classList.add('color-bar-plasma');
            break;
        case 'inferno':
            colorBar.classList.add('color-bar-inferno');
            break;
        case 'magma':
            colorBar.classList.add('color-bar-magma');
            break;
        case 'cividis':
            colorBar.classList.add('color-bar-cividis');
            break;
        case 'rainbow':
            colorBar.classList.add('color-bar-rainbow');
            break;
        case 'coolwarm':
            colorBar.classList.add('color-bar-coolwarm');
            break;
        default:
            console.log('Неизвестный вариант');
    }

    // openFiles.forEach(f => {
    project.files.forEach(f => {
        console.log();

        f =  replaceColormap(f, selectedValue);

    });

});


// Функция переключения темы
function applySettingsTheme(project) {
    const html = document.documentElement;
    if (project.settings.theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('project-theme', 'dark');
    }else {
        html.removeAttribute('data-theme');
        localStorage.setItem('project-theme', 'light');
    }
}
// Функция переключения темы
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    if (newTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('project-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
        localStorage.setItem('project-theme', 'light');
    }
}

// Применение сохраненной темы при загрузке страницы
(function applySavedTheme() {
    const savedTheme = localStorage.getItem('project-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();