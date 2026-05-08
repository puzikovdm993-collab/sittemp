// Обработчики событий мыши и клавиатуры

function handleKeyDown(e) {
    // здесь логика обработки клавиш

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



// Получение координат на canvas с учетом масштаба
function getCanvasCoords(e) {
    const file = getActiveFile();
    if (!file || !file.canvas) return { x: 0, y: 0 };

    const rect = file.canvas.getBoundingClientRect();
    // console.log("rect.x = "+ e.clientX);
    // console.log("rect.y = "+ e.clientY);

    return {
        x: Math.floor((e.clientX - rect.left) / zoom),
        y: Math.floor((e.clientY - rect.top) / zoom)
    };
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

            const coords = getCanvasCoords(e);
            const threshold = Math.max(10 / zoom, 5); // порог захвата

            // Проверяем, есть ли уже профиль и не перетаскиваем ли мы его
            if (currentProfile) {
                const distStart = Math.hypot(coords.x - currentProfile.x1, coords.y - currentProfile.y1);
                const distEnd = Math.hypot(coords.x - currentProfile.x2, coords.y - currentProfile.y2);
                const distLine = distanceToSegment(coords.x, coords.y, currentProfile.x1, currentProfile.y1, currentProfile.x2, currentProfile.y2);

                if (distStart < threshold) {
                    // Начинаем перетаскивать начало
                    dragMode = 'start';
                    isDrawing = true;
                    break;
                } else if (distEnd < threshold) {
                    // Перетаскиваем конец
                    dragMode = 'end';
                    isDrawing = true;
                    break;
                } else if (distLine < threshold) {
                    // Перемещаем весь профиль
                    dragMode = 'whole';
                    dragOffsetX = coords.x - currentProfile.x1;
                    dragOffsetY = coords.y - currentProfile.y1;
                    originalProfile = { ...currentProfile };
                    isDrawing = true;
                    break;
                }
            }

            // Если не попали в существующий профиль, начинаем новый
            startX = coords.x;
            startY = coords.y;
            lassoPoints = [{x: startX, y: startY}];
            isLassoClosed = false;
            isDrawing = true;
            break;
        }
        case 'lasso':

            matrixToImage();
            // Начало создания контура лассо
            lassoPoints = [{x: startX, y: startY}];
            isLassoClosed = false;
            isDrawing = true;
            break;
    }
}

// Обработка движения мыши
function handleMouseMove(e) {
    const file = getActiveFile();
    if (!file || !file.canvas) return;
    if (e.currentTarget !== file.canvas) return;

    ctx = file.ctx;
    canvas = file.canvas;

    const coords = getCanvasCoords(e);
    if (dom.cursorPos) {

        //console.log(coords.y+" "+coords.x);
        if (coords.y<0){
            coords.y = 0;
        }
        if (coords.x<0){
            coords.x = 0;
        }
        dom.cursorPos.textContent = `X: ${coords.x}, Y: ${coords.y}`;
        document.getElementById('cursorMatrixData').textContent = `d = ${file.matrix[coords.y][coords.x]}`;
    }

    if (!isDrawing) return;

    // Обработка рисования для различных инструментов
    switch (currentTool) {

        case 'profile': {
            // const file = getActiveFile();
            // if (!file) break;
            // ctx = file.ctx;
            // canvas = file.canvas;

            const coords = getCanvasCoords(e);

            if (!isDrawing) break;

            if (dragMode !== 'none') {
                // Режим перетаскивания существующего профиля
                redrawFromHistory(); // восстанавливаем основное изображение

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
                drawProfile(currentProfile);      // рисуем перемещаемый профиль
                updateGraph(currentProfile.x1, currentProfile.y1, currentProfile.x2, currentProfile.y2);
            } else {
                // Рисование нового профиля
                redrawFromHistory();
                drawProfileInProgress(startX, startY, coords.x, coords.y);
                updateGraph(startX, startY, coords.x, coords.y); // сразу обновляем график
            }
            break;
        }            
        case 'lasso':
            //redrawFromHistory();
            matrixToImage();
            // Добавление точек в контур лассо
            if (lassoPoints.length === 0) {
                lassoPoints.push({x: coords.x, y: coords.y});
            } else {
                const lastPoint = lassoPoints[lassoPoints.length - 1];
                const dist = Math.sqrt((coords.x - lastPoint.x) ** 2 + (coords.y - lastPoint.y) ** 2);
                if (dist > 5) {
                    lassoPoints.push({x: coords.x, y: coords.y});
                }
            }
            drawLasso(lassoPoints, coords.x, coords.y);
            break;
        case 'select':

                redrawFromHistory();
                ctx.strokeStyle = '#0078d7';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
                ctx.setLineDash([]);
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

    if (!isDrawing) return;

    ctx = file.ctx;
    canvas = file.canvas;

    const coords = getCanvasCoords(e);


    // Завершение рисования для различных инструментов
    switch (currentTool) {
        case 'profile': {
            const file = getActiveFile();
            if (!file) break;

            if (!isDrawing) break;

            if (dragMode !== 'none') {
                // Завершаем перетаскивание – ничего не сохраняем, просто выходим
                dragMode = 'none';
                originalProfile = null;
                // После перетаскивания профиль уже нарисован через drawProfile в mouseMove
                // Убедимся, что он остаётся видимым
                if (currentProfile) {
                    drawProfile(currentProfile);
                }
            } else {
                // Завершаем создание нового профиля
                // Сохраняем координаты
                currentProfile = {
                    x1: startX,
                    y1: startY,
                    x2: lastX,
                    y2: lastY
                };
                // Перерисовываем основное изображение из истории
                redrawFromHistory();
                // Рисуем профиль поверх
                drawProfile(currentProfile);
            }
            isDrawing = false;
            break;
        }
        case 'lasso': {
            // Завершение создания лассо
            if (lassoPoints.length < 2) {
                lassoPoints = [];
                file.selection = [];
                isLassoClosed = false;
                break;
            }
            
            isLassoClosed = true;
            lassoPoints.push({x: lassoPoints[0].x, y: lassoPoints[0].y});
            
            // Вычисление bounding box полигона
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of lassoPoints) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            
            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);
            
            if (width > 0 && height > 0) {
                // Создание временного canvas для выделения
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = width;
                tempCanvas.height = height;
                
                // Создание маски полигона
                tempCtx.beginPath();
                tempCtx.moveTo(lassoPoints[0].x - minX, lassoPoints[0].y - minY);
                for (let i = 1; i < lassoPoints.length; i++) {
                    tempCtx.lineTo(lassoPoints[i].x - minX, lassoPoints[i].y - minY);
                }
                tempCtx.closePath();
                tempCtx.clip();
                
                // Копирование изображения в выделенную область
                tempCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
                




                // Получение ImageData выделенной области
                selectionData = tempCtx.getImageData(0, 0, width, height);
                
                // Сохранение информации о выделении
                selection = {
                    x: minX,
                    y: minY,
                    w: width,
                    h: height,
                    points: lassoPoints.slice()
                };
                
                // Отрисовка выделения на основном canvas
                //redrawFromHistory();
                matrixToImage();
                drawLassoSelection(lassoPoints);

                //lassoPoints  = calculatePointsInsidePolygon(lassoPoints);
                //console.log(lassoPoints.length);
                file.selection = calculatePointsInsidePolygon(lassoPoints);

                saveState();
            }
            //console.log(calculatePointsInsidePolygon(lassoPoints,width,  height));

            // const file = getActiveFile();
            // if (!file) return;

            // for (let i = 0; i < lassoPoints123.length; i++) {
            //     file.matrix[lassoPoints123[i][1]][lassoPoints123[i][0]]=100; 
            // }

            
            break;
        }

        case 'select': {
            // Создание прямоугольного выделения
            selection = {
                x: Math.min(startX, coords.x),
                y: Math.min(startY, coords.y),
                w: Math.abs(coords.x - startX),
                h: Math.abs(coords.y - startY)
            };
            if (selection.w > 0 && selection.h > 0) {
                selectionData = ctx.getImageData(selection.x, selection.y, selection.w, selection.h);
            }
            break;
        }


    }

    isDrawing = false;
}

// Обработка двойного клика (для завершения лассо)
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


// Обработчик клика для ВСЕХ кнопок с классом "tab-action-btn"
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