/**
 * Установка курсора для canvas
 */
function setCanvasCursor() {
    const file = getActiveFile();
    if (!file) return;
    const cursor = currentTool === 'move' ? 'move' : 'crosshair';
    file.canvas.style.cursor = cursor;
}

/**
 * Установка активного инструмента
 */
function setTool(tool) {
    // Глобальное состояние
    currentTool = tool;

    // Обновление UI кнопок
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const toolBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (toolBtn) toolBtn.classList.add('active');

    //Обновление инфо-панели и курсора
    updateToolInfo();
    setCanvasCursor();

    // Управление модальным окном графика для профиля
    document.getElementById('graphModal').classList.toggle('active', tool === 'profile');


    // #region [Профиль] (VS Code)
    // Убираем нарисованный профиль при переключении с профиля
    if (tool !== 'profile') {
        const file = getActiveFile();

        if (file) {
            redrawFromHistory();
        }

        // Очищаем overlaycanvas
        const overlayCanvas = document.getElementById('overlayCanvas');
        if (overlayCanvas) {
            clearOverlayCanvas(overlayCanvas);
        }

        // Обновить данные на пустые (сохраняет настройки осей и т.д.)
        const plotlyDiv = document.getElementById('graphCanvas');
        if (plotlyDiv) {
            Plotly.react(plotlyDiv, [{
                x: [],
                y: [],
                type: 'scatter',
                mode: 'lines',
                line: { color: 'rgb(220, 60, 80)', width: 2.2 }
            }], plotlyDiv.layout, { responsive: true, displayModeBar: false });
        }
        
        currentProfile = null;
        dragMode = 'none';
    }
    // #endregion


    // #region [Лассо] (VS Code)
    // Сброс лассо при переключении с него
    if (tool !== 'lasso') {
        lassoPoints = [];
        isLassoClosed = false;
    }
    // #endregion


    //if (tool !== 'lasso') {
        // Очищаем overlaycanvas
        const overlayCanvas = document.getElementById('overlayCanvas');
        if (overlayCanvas) {
            clearOverlayCanvas(overlayCanvas);
        }

        collectionSelection.polygons = [];
        collectionSelection.pixels = [];
    //}


    

    // было(
    if (tool !== 'move' && isMoving) {
        isMoving = false;
        moveSelectionCanvas = null;
        redrawFromHistory();
        const file = getActiveFile();
        if (file) drawSelectionOverlay(file);
    }
}

/**
 * Обновление информации об инструменте в статус-баре
 */
function updateToolInfo() {
    const toolNames = {
        cursor: 'Курсор',
        profile: 'Профиль',
        lasso: 'Лассо (Клик для начала, двойной клик для завершения)',
        move: 'Перемещение выделения',
        rectangle: 'Выбор прямоугольный: Левая кнопка: Заменить. Ctrl+Left:Добавить. Правая: Вычесть. Ctrl+Right: Инвертировать. Shift: Квадрат.'
    };
    const toolInfoElement = document.getElementById('toolInfo');
    if (toolInfoElement) {
        toolInfoElement.textContent = `Инструмент: ${toolNames[currentTool] || currentTool}`;
    }
}
