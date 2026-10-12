
// Все функции рисования (фигуры, лассо, заливка, текст, профиль)

// // Геометрические алгоритмы
// Алгоритм Брезенхема для профиля
function bresenham(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0, y = y0;
    while (true) {
        points.push({x: Math.round(x), y: Math.round(y)});
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 <  dx) { err += dx; y += sy; }
    }
    return points;
}
// Отсечение отрезка (Коэн‑Сазерленд)
function clipLine(x0, y0, x1, y1, minX, minY, maxX, maxY) {
    const INSIDE = 0; const LEFT = 1; const RIGHT = 2; const BOTTOM = 4; const TOP = 8;

    function computeOutCode(x, y) {
        let code = INSIDE;
        if (x < minX) code |= LEFT;
        else if (x > maxX) code |= RIGHT;
        if (y < minY) code |= BOTTOM;
        else if (y > maxY) code |= TOP;
        return code;
    }

    let code0 = computeOutCode(x0, y0);
    let code1 = computeOutCode(x1, y1);
    let accept = false;

    while (true) {
        if (!(code0 | code1)) {
            accept = true;
            break;
        } else if (code0 & code1) {
            break;
        } else {
            let codeOut = code0 ? code0 : code1;
            let x, y;

            if (codeOut & TOP) {
                x = x0 + (x1 - x0) * (maxY - y0) / (y1 - y0);
                y = maxY;
            } else if (codeOut & BOTTOM) {
                x = x0 + (x1 - x0) * (minY - y0) / (y1 - y0);
                y = minY;
            } else if (codeOut & RIGHT) {
                y = y0 + (y1 - y0) * (maxX - x0) / (x1 - x0);
                x = maxX;
            } else if (codeOut & LEFT) {
                y = y0 + (y1 - y0) * (minX - x0) / (x1 - x0);
                x = minX;
            }

            if (codeOut == code0) {
                x0 = x; y0 = y;
                code0 = computeOutCode(x0, y0);
            } else {
                x1 = x; y1 = y;
                code1 = computeOutCode(x1, y1);
            }
        }
    }

    if (accept) {
        return { x0, y0, x1, y1 };
    } else {
        return null;
    }
}
// Обновление графика профиля
function updateGraph(x1, y1, x2, y2) {
    const file = getActiveFile();

    if (!file) return;

    // Получаем размеры изображения как границы отсечения
    const minX = 0, minY = 0, maxX = file.width - 1, maxY = file.height - 1;
    const clipped = clipLine(x1, y1, x2, y2, minX, minY, maxX, maxY);
    if (!clipped) return;

    // Проверяем, что координаты в пределах матрицы изображения
    const x0_img = Math.round(clipped.x0);
    const y0_img = Math.round(clipped.y0);
    const x1_img = Math.round(clipped.x1);
    const y1_img = Math.round(clipped.y1);
    
    // Ограничиваем координаты размерами изображения
    const clampedX0 = Math.max(0, Math.min(file.width - 1, x0_img));
    const clampedY0 = Math.max(0, Math.min(file.height - 1, y0_img));
    const clampedX1 = Math.max(0, Math.min(file.width - 1, x1_img));
    const clampedY1 = Math.max(0, Math.min(file.height - 1, y1_img));

    const pts = bresenham(clampedX0, clampedY0, clampedX1, clampedY1);
    if (pts.length < 2) return;

    const reds = pts.map(p => file.matrix[p.y][p.x]);
    const minVal = Math.min(...reds);
    const maxVal = Math.max(...reds);
    const padding = (maxVal - minVal) * 0.08 || 10;
    const yMin = Math.max(0, Math.floor(minVal - padding));
    const yMax = Math.min(255, Math.ceil(maxVal + padding));
    
    const plotlyDiv = document.getElementById('graphCanvas');
    Plotly.update(plotlyDiv, {
        x: [Array.from({ length: reds.length }, (_, i) => i)],
        y: [reds]
    }, {
        'yaxis.range': [yMin, yMax]
    }, [0]);
}

// // Фигуры
// function drawShape(shape, x1, y1, x2, y2, color)
// function drawStar(cx, cy, spikes, outerR, innerR)


// Отрисовка прямоугольного выделения с "марширующей" рамкой
function drawRectangleSelection(x, y, w, h) {
    const file = getActiveFile();
    if (!file || w <= 0 || h <= 0) return;
    const ctx = file.ctx;

    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = `rgba(0, 120, 215, ${LASSO_FILL_OPACITY})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
}

// Вычисление всех точек внутри прямоугольника
function calculatePointsInsideRectangle(x, y, w, h) {
    const points = [];
    const minX = Math.max(0, Math.floor(x));
    const maxX = Math.min(getActiveFile().width - 1, Math.ceil(x + w));
    const minY = Math.max(0, Math.floor(y));
    const maxY = Math.min(getActiveFile().height - 1, Math.ceil(y + h));

    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            points.push([px, py]);
        }
    }
    return points;
}





    



// // Заливка
// function floodFill(x, y, fillColor)
// function getPixelColor(data, width, x, y)
// function setPixelColor(data, width, x, y, color)
// function colorsMatch(c1, c2)
// function hexToRgb(hex)

// // Текст
// function showTextInput(clientX, clientY, canvasX, canvasY, color)

// Профиль


// Отрисовка профиля и маркеров
function drawProfile(profile) {
    if (!profile) return;
    const file = getActiveFile();
    if (!file) return;
    const ctx = file.ctx;

    // Рисуем линию профиля
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(profile.x1, profile.y1);
    ctx.lineTo(profile.x2, profile.y2);
    ctx.stroke();

    // Определяем цвет маркеров в зависимости от выбора
    let startColor = '#0078d7'; // синий по умолчанию
    let endColor = '#0078d7';   // синий по умолчанию
    
    if (selectedPoint === 'start') {
        startColor = '#ffff00'; // желтый для выбранной начальной точки
    } else if (selectedPoint === 'end') {
        endColor = '#ffa500';   // оранжевый для выбранной конечной точки
    }

    // Рисуем концевые маркеры
    ctx.fillStyle = startColor;
    ctx.beginPath();
    ctx.arc(profile.x1, profile.y1, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = endColor;
    ctx.beginPath();
    ctx.arc(profile.x2, profile.y2, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Обновляем график
    updateGraph(profile.x1, profile.y1, profile.x2, profile.y2);
}
// Отрисовка линии профиля во время создания (красная линия + синие маркеры)
function drawProfileInProgress(x1, y1, x2, y2) {
   
    const file = getActiveFile();
    if (!file) return;
    
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (!overlayCanvas) return;
    
    // Синхронизируем размеры overlayCanvas с canvasHost
    const canvasHost = document.getElementById('canvasHost');
    if (canvasHost) {
        overlayCanvas.width = canvasHost.offsetWidth;
        overlayCanvas.height = canvasHost.offsetHeight;
    }
    
    const ctx = overlayCanvas.getContext('2d');
    
    // Очищаем overlay canvas перед рисованием
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Ограничиваем координаты пределами canvasHost с помощью алгоритма отсечения
    const minX = 0;
    const minY = 0;
    const maxX = overlayCanvas.width - 1;
    const maxY = overlayCanvas.height - 1;
    
    // Используем алгоритм отсечения Cohen-Sutherland
    const clipped = clipLine(x1, y1, x2, y2, minX, minY, maxX, maxY);
    



    if (!clipped) {
        // Линия полностью за пределами canvas, ничего не рисуем
        return;
    }
    
    // Линия красным цветом
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(clipped.x0, clipped.y0);
    ctx.lineTo(clipped.x1, clipped.y1);
    ctx.stroke();
    //console.log('clipped.x0 ',clipped.x0,' clipped.y0 ',clipped.y0,' clipped.x1 ',clipped.x1,' clipped.y1 ',clipped.y1)

    // Маркеры на концах (синие кружки) - рисуем только если оригинальные точки в пределах canvas
    ctx.fillStyle = '#ff0000';
    
    // Рисуем первый маркер, если он в пределах
    if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) {
        ctx.beginPath();
        ctx.arc(x1, y1, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Рисуем второй маркер, если он в пределах
    if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) {
        ctx.beginPath();
        ctx.arc(x2, y2, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
   
}

// Отрисовка подсветки начальной и конечной точки профиля при наведении
function drawProfileHover(mouseX, mouseY) {
    const file = getActiveFile();
    if (!file || !currentProfile) return;
    
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (!overlayCanvas) return;
    
    const ctx = overlayCanvas.getContext('2d');
    
    const threshold = Math.max(10 / zoom, 5);
    
    // Проверяем расстояние до начальной точки
    const distStart = Math.hypot(mouseX - currentProfile.x1, mouseY - currentProfile.y1);
    if (distStart < threshold) {
        // Подсветка начальной точки - желтый круг с обводкой
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(currentProfile.x1, currentProfile.y1, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Текст "Начало"
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Начало', currentProfile.x1 + 10, currentProfile.y1 - 10);
    }
    
    // Проверяем расстояние до конечной точки
    const distEnd = Math.hypot(mouseX - currentProfile.x2, mouseY - currentProfile.y2);
    if (distEnd < threshold) {
        // Подсветка конечной точки - оранжевый круг с обводкой
        ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(currentProfile.x2, currentProfile.y2, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Текст "Конец"
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Конец', currentProfile.x2 + 10, currentProfile.y2 - 10);
    }
}

