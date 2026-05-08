// Управление инструментами

// Установка курсора для canvas
function setCanvasCursor() {
    const file = getActiveFile();
    if (!file) return;
    const cursor = currentTool === 'move' ? 'move' : 'crosshair';
    file.canvas.style.cursor = cursor;
}


// Установка активного инструмента
function questionActiveFile() {
    const file = getActiveFile();
    if (!file) {console.log("!file => return"); return;}
    console.log(activeFileId);
    console.log(file);

}

// Установка активного инструмента
function questionProject() {
    console.log(project);
}

// Установка активного инструмента
function setTool(tool) {
    currentTool = tool;

    // Обновление UI кнопок
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const toolBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (toolBtn) toolBtn.classList.add('active');
    updateToolInfo();
    setCanvasCursor();


    // #region [Профиль] (VS Code)
    // Показываем график только для профиля
    if (tool == 'profile') {
        document.getElementById('graphModal').classList.add('active');
    }
    if (tool !== 'profile') {
        document.getElementById('graphModal').classList.remove('active');
    }
    // Убираем нарисованный профиль при переключении с профиля
    if (tool !== 'profile') {
        const file = getActiveFile();
        if (file) {
            redrawFromHistory();
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

    // Подсказка для лассо
    if (tool === 'lasso') {
        const toolInfoElement = document.getElementById('toolInfo');
        if (toolInfoElement) {
            toolInfoElement.textContent = 'Инструмент: Лассо (Клик для начала, двойной клик для завершения)';
        }
    }
    // #endregion


    
    // #region [Выбор прямоугольный] (VS Code)
    // Сброс лассо при переключении с него
    // if (tool !== 'rectangle') {
    //     lassoPoints = [];
    //     isLassoClosed = false;
    // }

    // Подсказка для Выбор прямоугольный
    if (tool === 'rectangle') {
        const toolInfoElement = document.getElementById('toolInfo');
        if (toolInfoElement) {
            toolInfoElement.textContent = 'Инструмент: Выбор прямоугольный: Левая кнопка: Заменить. Ctrl+Left:Добавить. Правая: Вычесть. Ctrl+Right: Инвертировать. Shift: Квадрат.';
        }
    }
    // #endregion





    // Если переключились с move во время перемещения – отменяем
    if (tool !== 'move' && isMoving) {
        isMoving = false;
        moveSelectionCanvas = null;
        redrawFromHistory();
        const file = getActiveFile();
        if (file) drawSelectionOverlay(file);
    }


}

// Обновление информации об инструменте в статус-баре
function updateToolInfo() {
    const toolNames = {
        cursor: 'Курсор',
        profile: 'Профиль',
        lasso: 'Лассо',
        move: 'Перемещение выделения',
        rectangle: 'Выбор прямоугольный'
    };
    const toolInfoElement = document.getElementById('toolInfo');
    if (toolInfoElement) {
        toolInfoElement.textContent = `Инструмент: ${toolNames[currentTool] || currentTool}`;
    }
}


// function setShape(shape)
// function toggleShapesPanel()
// function setBrushSize(size, ev)