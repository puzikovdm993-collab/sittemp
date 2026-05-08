// ============ Система истории (Undo/Redo) ============

// Глобальная переменная для хранения названия текущего действия
let currentActionName = 'Изменение';

// Глобальная переменная для хранения параметров текущего действия
let currentActionParams = null;

// Функция для установки названия действия перед сохранением состояния
function setActionName(name, params = null) {
    currentActionName = name;
    currentActionParams = params;
}


// Сброс истории для файла
function resetHistory(file) {
    file.history = [];
    file.historyIndex = -1;
}

// Добавление состояния в историю
function pushState(file) {
    file.historyIndex++;
    file.history = file.history.slice(0, file.historyIndex);
    file.history.push(captureState(file));

    console.log(file.history);

    if (file.history.length > maxHistory) {
        file.history.shift();
        file.historyIndex--;
    }
        // Сбрасываем название действия и параметры после сохранения
        currentActionName = 'Изменение';
        currentActionParams = null;

    // Обновляем окно истории, если оно открыто
    if (typeof isHistoryModalOpen === 'function' && isHistoryModalOpen()) {
        updateHistoryModal();
    }
}

// Восстановление состояния canvas из снимка
function restoreState(file, state) {
    console.log('restoreState');

    file.canvas.width = state.matrix.length;
    file.canvas.height = state.matrix[0].length;

    file.ctx = file.canvas.getContext('2d', { willReadFrequently: true });
    file.ctx.putImageData(state.ctx, 0, 0);
    if (state.selection.length === 0){file.selection = [];}
    else{file.selection =state.selection}


    if (file.id === activeFileId) {
        canvas = file.canvas;
        ctx = file.ctx;
        applyZoom();
        updateCanvasSize();
    }
}

// Сохранение текущего состояния
function saveState() {
    const file = getActiveFile();
    if (!file) return;
    pushState(file);
    console.log(file);
}

// Перерисовка canvas из последнего состояния истории
function redrawFromHistory() {
    const file = getActiveFile();
    if (!file) return;
    

    if (file.historyIndex <= 0) return;
    const state = file.history[file.historyIndex-1];
    // // Проверка соответствия размеров
    // if (file.canvas.width !== state.w || file.canvas.height !== state.h) {
    //     console.log(1);
    //     restoreState(file, state);
    //     return;
    // }
    console.log(2);

    file.ctx.putImageData(state.ctx, 0, 0);
    
    // Очищаем toolsCanvas при восстановлении из истории
    clearToolsCanvas();
}

// Очистка toolsCanvas
function clearToolsCanvas() {
    const toolsCanvas = dom.toolsCanvas;
    if (!toolsCanvas) return;
    const ctx = toolsCanvas.getContext('2d');
    ctx.clearRect(0, 0, toolsCanvas.width, toolsCanvas.height);
}

// Отмена последнего действия
function undo() {
    const file = getActiveFile();
    if (!file) return;
    if (file.historyIndex > 0) {
        file.historyIndex--;
        restoreState(file, file.history[file.historyIndex]);
    }
}

// Повтор отмененного действия
function redo() {
    const file = getActiveFile();
    if (!file) return;
    if (file.historyIndex < file.history.length - 1) {
        file.historyIndex++;
        restoreState(file, file.history[file.historyIndex]);
    }
}

// Улучшенный захват состояния — автоматически определяет название действия
function captureState123(file) {
    let action = 'Изменение';

    // Приоритет 1: если в текущем инструменте есть понятное название
    if (currentTool) {
        const toolNames = {
            'cursor' : 'Курсор',
            'profile': 'Профиль',
            'lasso': 'Лассо',
            'move' : 'Перемещение выделения'           
        };
        if (toolNames[currentTool]) action = toolNames[currentTool];
    }

    return {
        w: file.canvas.width,
        h: file.canvas.height,
        data: file.ctx.getImageData(0, 0, file.canvas.width, file.canvas.height),
        timestamp: Date.now(),
        action: action
    };
}
// Улучшенный захват состояния — автоматически определяет название действия
function captureState(file) {

    let action = currentActionName;
    let params = currentActionParams;


    // let action = 'Действие';
    // // Приоритет 1: если в текущем инструменте есть понятное название
    // if (currentTool) {
    //     const toolNames = {
    //         'cursor' : 'Курсор',
    //         'profile': 'Профиль',
    //         'lasso': 'Лассо',
    //         'move' : 'Перемещение выделения'           
    //     };
    //     if (toolNames[currentTool]) action = toolNames[currentTool];
    // }

    return {
        dpi:file.dpi,
        colormap:file.colormap,
        matrix:file.matrix,
        selection:file.selection,
        ctx: file.ctx.getImageData(0, 0, file.canvas.width, file.canvas.height),
        action: action,
        params: params
    };
}