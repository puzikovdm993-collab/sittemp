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

    updateHistoryFile(project.id, file.id);

    // console.log(captureState(file));
    // console.log(file.history);



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
function pushState_l(file) {
    file.historyIndex++;
    file.history = file.history.slice(0, file.historyIndex);
    file.history.push(captureState(file));


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

async function updateHistoryFile(projectId, fileId) {

    try {

        // Безопасная очистка от canvas/ctx
        const cleanedProject = cleanSensitiveProperties(project);
        console.log('Sending cleaned project:', cleanedProject);

    
        // 2. Ищем файл по ID
        const file = cleanedProject.files.find(
            (f) => f.id === fileId
        );
        console.log("Файл найден:", file);



        const jsonPretty = JSON.stringify(file.history, null, 2);
        console.log(file.history); 

        const API_BASE_URL = window.location.origin;

        const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/files/${fileId}/history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Если требуется аутентификация, добавьте заголовок здесь:
                // 'Authorization': 'Bearer <your_token>'
            },
            body: JSON.stringify({ file: file })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Успешно обновлено:', result);
        return result;

    } catch (error) {
        console.error('Ошибка при обновлении файла:', error);
        throw error;
    }
}

// Восстановление состояния
function restoreState(file, state) {
    // console.log('restoreState');
    // console.log(state)

    file.canvas.width = state.w
    file.canvas.height = state.h;

    file.ctx = file.canvas.getContext('2d', { willReadFrequently: true });
    file.ctx.putImageData(state.ctx, 0, 0);

    currentActionName = state.action;
    file.dpi = state.dpi;
    file.colormap = state.colormap;
    file.matrix = state.matrix;




    if (state.selection.length === 0) {
        file.selection = [];
    }
    else {
        file.selection = state.selection
    }
    setМalueСolorbarlabel(file.minValue, file.maxValue);
 
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
    console.log('saveState');
}

// Перерисовка canvas из последнего состояния истории
function redrawFromHistory() {
    const file = getActiveFile();
    if (!file) return;
    if (file.historyIndex < 0) return;
    const state = file.history[file.historyIndex];
    file.ctx.putImageData(state.ctx, 0, 0);
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

// Захват состояния
function captureState(file) {

    let action = currentActionName;
    let params = currentActionParams;

    return {
        action: action,
        dpi:file.dpi,
        colormap:file.colormap,
        matrix:file.matrix,
        selection:file.selection, 
        ctx: file.ctx.getImageData(0, 0, file.canvas.width, file.canvas.height),
        action: action,
        params: params,
        w: file.canvas.width,
        h: file.canvas.height,
        timestamp: Date.now()
    };
}