/**
 * Показать логика обработки клавиш
 */
function handleKeyDown(e) {
    if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
            case 'z': e.preventDefault(); undo(); break; // Ctrl+Z - отменить
            case 'y': e.preventDefault(); redo(); break; // Ctrl+Y - повторить
            case 's': e.preventDefault(); showSaveMethodModal(); break; // Ctrl+S - сохранить
            case 'o': e.preventDefault(); document.getElementById('run').click(); break; // Ctrl+O - открыть
            case 'l': e.preventDefault(); showLoadFromServerModal(); break; // Ctrl+L - загрузить с сервера
            case 'n': e.preventDefault(); newImage(); break; // Ctrl+N - новый файл
            case 'tab': e.preventDefault(); cycleThroughFiles(); break; // Ctrl+Tab для переключения файлов
        }
    }
    if (e.altKey) {
        switch (e.key.toLowerCase()) {
            case 'r': e.preventDefault(); rotateCanvas(90); break; // ALT+R - поворот
        }
    }
    // Ctrl+Shift+R для открытия списка недавних файлов
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        showRecentFilesModal();
    }
}

/**
 * Изменяем стандартное масштабирование
 */
function handleWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault(); // Отключаем стандартное масштабирование браузера
        
        // Проверяем направление прокрутки
        const deltaY = e.deltaY; // >0 - вниз, <0 - вверх
        if (deltaY > 0) {
            zoomOut(); // Прокрутка вниз → масштабировать "на себя" (уменьшение)
        } else {
            zoomIn();  // Прокрутка вверх → масштабировать "от себя" (увеличение)
        }
        
        // Возвращаем true, чтобы предотвратить стандартное поведение
        return true;
    }
}

/**
 * Обработка двойного клика (для завершения лассо)
 */ 
function handleDoubleClick(e) {
    if (currentTool === 'lasso' && lassoPoints.length > 2) {
        isDrawing = false;
        // Симуляция события mouseup для завершения рисования
        const event = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        e.currentTarget.dispatchEvent(event);
    }
}

/**
 * Обработчик клика для ВСЕХ кнопок с классом "tab-action-btn"
 */
document.querySelectorAll('.tab-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        //if(currentTool == "profile"){

            if (currentTool == 'profile' && currentProfile !=null ) {
                
                redrawFromHistory();
                currentProfile = null;

            }
            setTimeout(() => isProcessing = false, 300); // защита от множественных кликов
        //}
    });
});





/**
 * Получение координат на canvas с учетом масштаба
 */
function getCanvasCoords(e) {
    const file = getActiveFile();
    if (!file || !file.canvas) return { x: 0, y: 0 };

    const rect = file.canvas.getBoundingClientRect();

    let x = Math.floor((e.clientX - rect.left) / zoom);
    let y = Math.floor((e.clientY - rect.top) / zoom);
    
    // Ограничиваем координаты пределами изображения
    x = Math.max(0, Math.min(file.width - 1, x));
    y = Math.max(0, Math.min(file.height - 1, y));
    
    return { x, y };
}

/**
 * Получение координат с ограничением по overlayCanvas (для profile tool)
 */ 
function getCanvasCoordsClamped(e) {
    const file = getActiveFile();
    if (!file || !file.canvas) return { x: 0, y: 0 };

    const rect = file.canvas.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left) / zoom);
    let y = Math.floor((e.clientY - rect.top) / zoom);
    
    // Получаем размеры overlayCanvas для ограничения
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (overlayCanvas) {
        // Ограничиваем координаты пределами overlayCanvas
        x = Math.max(0, Math.min(overlayCanvas.width - 1, x));
        y = Math.max(0, Math.min(overlayCanvas.height - 1, y));
    }
    
    // Дополнительно ограничиваем пределами изображения
    x = Math.max(0, Math.min(file.width - 1, x));
    y = Math.max(0, Math.min(file.height - 1, y));
    
    return { x, y };
}


/**
 * Глобальные обработчики для profile tool (чтобы рисование не прерывалось при выходе за canvas)
 */
function handleGlobalMouseMove(e) {
    if (currentTool !== 'profile' || !isDrawing) return;
    
    const file = getActiveFile();
    if (!file || !file.canvas) return;

    ctx = file.ctx;
    canvas = file.canvas;

    // Получаем координаты относительно окна, затем переводим в координаты canvas
    const rect = file.canvas.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left) / zoom);
    let y = Math.floor((e.clientY - rect.top) / zoom);
    
    // Ограничиваем координаты пределами overlayCanvas
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (overlayCanvas) {
        x = Math.max(0, Math.min(overlayCanvas.width - 1, x));
        y = Math.max(0, Math.min(overlayCanvas.height - 1, y));
    }
    
    // Дополнительно ограничиваем пределами изображения
    x = Math.max(0, Math.min(file.width - 1, x));
    y = Math.max(0, Math.min(file.height - 1, y));
    
    const coords = { x, y };
    
    if (dom.cursorPos) {
        dom.cursorPos.textContent = `X: ${coords.x}, Y: ${coords.y}`;
        if (coords.y >= 0 && coords.y < file.height && coords.x >= 0 && coords.x < file.width) {
            document.getElementById('cursorMatrixData').textContent = `d = ${file.matrix[coords.y][coords.x]}`;
        }
    }

    if (dragMode !== 'none') {
        // Режим перетаскивания существующего профиля
        redrawFromHistory();

        if (dragMode === 'start') {
            currentProfile.x1 = coords.x;
            currentProfile.y1 = coords.y;
        } else if (dragMode === 'end') {
            currentProfile.x2 = coords.x;
            currentProfile.y2 = coords.y;
        } else if (dragMode === 'whole') {
            const dx = coords.x - dragOffsetX - originalProfile.x1;
            const dy = coords.y - dragOffsetY - originalProfile.y1;
            currentProfile.x1 = originalProfile.x1 + dx;
            currentProfile.y1 = originalProfile.y1 + dy;
            currentProfile.x2 = originalProfile.x2 + dx;
            currentProfile.y2 = originalProfile.y2 + dy;
        }
        // drawProfile(currentProfile);
        drawProfileInProgress(startX, startY, coords.x, coords.y);
        updateGraph(currentProfile.x1, currentProfile.y1, currentProfile.x2, currentProfile.y2);
    } else if (selectedPoint) {
        // Режим перемещения выбранной точки профиля
        redrawFromHistory();
        
        if (selectedPoint === 'start') {
            currentProfile.x1 = coords.x;
            currentProfile.y1 = coords.y;
        } else if (selectedPoint === 'end') {
            currentProfile.x2 = coords.x;
            currentProfile.y2 = coords.y;
        }
        
        // drawProfile(currentProfile);
        drawProfileInProgress(startX, startY, coords.x, coords.y);
        updateGraph(currentProfile.x1, currentProfile.y1, currentProfile.x2, currentProfile.y2);
    } else {
        // Рисование нового профиля

        redrawFromHistory();
        drawProfileInProgress(startX, startY, coords.x, coords.y);
        updateGraph(startX, startY, coords.x, coords.y);
    }
    
    lastX = coords.x;
    lastY = coords.y;
}

function handleGlobalMouseUp(e) {
    if (currentTool !== 'profile' || !isDrawing) return;
    
    const file = getActiveFile();
    if (!file || !file.canvas) return;

    ctx = file.ctx;
    canvas = file.canvas;

    // Получаем координаты относительно окна, затем переводим в координаты canvas
    const rect = file.canvas.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left) / zoom);
    let y = Math.floor((e.clientY - rect.top) / zoom);
    
    // Ограничиваем координаты пределами overlayCanvas
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (overlayCanvas) {
        x = Math.max(0, Math.min(overlayCanvas.width - 1, x));
        y = Math.max(0, Math.min(overlayCanvas.height - 1, y));
    }
    
    // Дополнительно ограничиваем пределами изображения
    x = Math.max(0, Math.min(file.width - 1, x));
    y = Math.max(0, Math.min(file.height - 1, y));
    
    const coords = { x, y };

    if (dragMode !== 'none') {
        // Завершаем перетаскивание всего профиля – сохраняем изменения в историю
        dragMode = 'none';
        originalProfile = null;
        saveState(); // Сохраняем состояние после перемещения
        // Восстанавливаем курсор
        if (file.canvas) {
            file.canvas.style.cursor = 'crosshair';
        }
    } else if (selectedPoint) {
        // Завершаем перемещение выбранной точки - сбрасываем выбор (второй клик)
        selectedPoint = null;
        saveState(); // Сохраняем состояние после перемещения точки
        if (file.canvas) {
            file.canvas.style.cursor = 'crosshair';
        }
    } else {
        // Завершаем создание нового профиля
        if (lassoPoints.length > 0 || true) {
            // Сохраняем координаты
            currentProfile = {
                x1: startX,
                y1: startY,
                x2: lastX,
                y2: lastY
            };
            // Перерисовываем финальную версию
            redrawFromHistory();
            drawProfileInProgress(startX, startY, coords.x, coords.y);
        }
    }
    
    isDrawing = false;
    

    
    // Восстанавливаем курсор
    if (file.canvas) {
        file.canvas.style.cursor = 'crosshair';
    }
    
    // Удаляем глобальные обработчики
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
}






// Обработка нажатия кнопки мыши
function handleMouseDown(e) {
    const file = getActiveFile();
    if (!file || !file.canvas) return;



    // Проверка активного canvas
    if (e.currentTarget !== file.canvas) return;

    ctx = file.ctx;
    canvas = file.canvas;

    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;
    lastX = coords.x;
    lastY = coords.y;
    isDrawing = true;


    // Обработка различных инструментов
    switch (currentTool) {
        case 'profile': {
            const file = getActiveFile();
            if (!file) break;

            const coords = getCanvasCoordsClamped(e);
            const threshold = Math.max(10 / zoom, 5); // порог захвата
            
           
            // Если уже выбрана точка для перемещения, начинаем её перемещение
            if (selectedPoint) {
                isDrawing = true;
                file.canvas.style.cursor = 'move';
                // Добавляем глобальные обработчики для перемещения точки
                window.addEventListener('mousemove', handleGlobalMouseMove);
                window.addEventListener('mouseup', handleGlobalMouseUp);
                break;
            }

            // Проверяем, есть ли уже профиль и не перетаскиваем ли мы его
            if (currentProfile && !selectedPoint) {
                const distStart = Math.hypot(coords.x - currentProfile.x1, coords.y - currentProfile.y1);
                const distEnd = Math.hypot(coords.x - currentProfile.x2, coords.y - currentProfile.y2);
                const distLine = distanceToSegment(coords.x, coords.y, currentProfile.x1, currentProfile.y1, currentProfile.x2, currentProfile.y2);

                if (distStart < threshold) {
                    // Выбираем начальную точку для перемещения (первый клик)
                    selectedPoint = 'start';
                    isDrawing = false; // Не рисуем новый профиль
                    file.canvas.style.cursor = 'move';
                    // Не добавляем обработчики здесь, они добавятся при следующем mousedown
                    break;
                } else if (distEnd < threshold) {
                    // Выбираем конечную точку для перемещения (первый клик)
                    selectedPoint = 'end';
                    isDrawing = false; // Не рисуем новый профиль
                    file.canvas.style.cursor = 'move';
                    // Не добавляем обработчики здесь, они добавятся при следующем mousedown
                    break;
                } else if (distLine < threshold) {
                    // Перемещаем весь профиль
                    dragMode = 'whole';
                    dragOffsetX = coords.x - currentProfile.x1;
                    dragOffsetY = coords.y - currentProfile.y1;
                    originalProfile = { ...currentProfile };
                    isDrawing = true;
                    file.canvas.style.cursor = 'move';
                    break;
                }
            }

            // Если не попали в существующий профиль, начинаем новый
            startX = coords.x;
            startY = coords.y;
            isLassoClosed = false;
            isDrawing = true;
            
            // Сбрасываем курсор при создании нового профиля
            file.canvas.style.cursor = 'crosshair';
            
            // Добавляем глобальные обработчики для profile tool
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            break;
        }
        case 'lasso':
            handleMouseDownSelection()
            break;
        case 'rectangle':
            handleMouseDownSelection()
            break;
    }
    
    // Сброс курсора при начале рисования/выделения
    if (isDrawing && file.canvas) {
        file.canvas.style.cursor = 'crosshair';
    }
}



// Обработка движения мыши
function handleMouseMove(e) {
    const file = getActiveFile()
    if (!file || !file.canvas) return;

    const coords = getCanvasCoords(e);
    if (dom.cursorPos) {
        dom.cursorPos.textContent = `X: ${coords.x}, Y: ${coords.y}`;
        document.getElementById('cursorMatrixData').textContent = `d = ${file.matrix[coords.y][coords.x]}`;
    }
    if (e.currentTarget !== file.canvas) return;
    if (!isDrawing) return;

    ctx = file.ctx;
    canvas = file.canvas;
    // Если рисуем профиль, глобальные обработчики уже работают, выходим
    if (currentTool === 'profile') return;

    // Проверка наведения на профиль для изменения курсора (только если не рисуем и не перемещаем точку)
    if (currentTool === 'profile' && !isDrawing && currentProfile && !selectedPoint) {
        const threshold = Math.max(10 / zoom, 5);
        const distStart = Math.hypot(coords.x - currentProfile.x1, coords.y - currentProfile.y1);
        const distEnd = Math.hypot(coords.x - currentProfile.x2, coords.y - currentProfile.y2);
        const distLine = distanceToSegment(coords.x, coords.y, currentProfile.x1, currentProfile.y1, currentProfile.x2, currentProfile.y2);
        
        let hoverOnProfile = false;
        if (distStart < threshold || distEnd < threshold || distLine < threshold) {
            file.canvas.style.cursor = 'move';
            hoverOnProfile = true;
        } else {
            file.canvas.style.cursor = 'crosshair';
        }
        
        // Отрисовка подсветки точек только при наведении
        redrawFromHistory();
        // drawProfile(currentProfile);
        drawProfileInProgress(startX, startY, coords.x, coords.y);
        if (hoverOnProfile) {
            drawProfileHover(coords.x, coords.y);
        }
        return;
    }
    
    // Если выбрана точка для перемещения, обновляем курсор
    if (currentTool === 'profile' && selectedPoint) {
        file.canvas.style.cursor = 'move';
        return;
    }
    


    // Обработка рисования для различных инструментов
    switch (currentTool) {
        case 'lasso':
            handleMouseMoveSelection(e,coords);
            break;
        case 'rectangle':
            handleMouseMoveSelection(e,coords);
            break;
    }

    lastX = coords.x;
    lastY = coords.y;
}




// Обработка отпускания кнопки мыши
function handleMouseUp(e) {
    const file = getActiveFile();
    if (!file || !file.canvas) return;
    if (e.currentTarget !== file.canvas) return;

    // Для profile tool обработка уже выполнена в handleGlobalMouseUp
    if (currentTool === 'profile') return;

    if (!isDrawing) return;

    ctx = file.ctx;
    canvas = file.canvas;

    const coords = getCanvasCoordsClamped(e);


    // Завершение рисования для различных инструментов
    switch (currentTool) {
        case 'lasso': {
            handleMouseUpSelection(e,coords);
            break;
        }

        case 'rectangle': {
            handleMouseUpSelection(e,coords);
            break;
        }


    }

    isDrawing = false;
    
    // Восстанавливаем курсор после завершения операции
    if (file.canvas) {
        file.canvas.style.cursor = 'default';
    }
}








/**
 * Алгоритм определения нахождения точки внутри многоугольника (Ray Casting)
 * @param {Array<Array<number>>} points - Массив вершин [[x1, y1], [x2, y2], ...]
 * @param {number} px - Координата X проверяемой точки
 * @param {number} py - Координата Y проверяемой точки
 * @returns {boolean}
 */
 function isPointInPolygon(points, px, py) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];

        const intersect = (
            ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        );
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Расчёт всех целых точек внутри полигона
 * @param {Array<Array<number>>} Lpoints - Координаты вершин полигона
 * @returns {Array<Array<number>>} Массив всех точек внутри и на контуре
 */
function calculatePointsInsidePolygon(Lpoints) {
    const allPoints = [...Lpoints];

    const xs = Lpoints.map(p => p[0]);
    const ys = Lpoints.map(p => p[1]);

    const minX = Math.floor(Math.min(...xs));
    const maxX = Math.ceil(Math.max(...xs));
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));

    // console.log('Bounding Box:', { minX, maxX, minY, maxY });

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (isPointInPolygon(Lpoints, x, y)) {
                allPoints.push([x, y]);
            }
        }
    }

    return allPoints;
}

