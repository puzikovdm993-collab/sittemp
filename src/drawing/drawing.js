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

    const minX = 0, minY = 0, maxX = file.width - 1, maxY = file.height - 1;
    const clipped = clipLine(x1, y1, x2, y2, minX, minY, maxX, maxY);
    if (!clipped) return;

    const pts = bresenham(
        Math.round(clipped.x0), Math.round(clipped.y0),
        Math.round(clipped.x1), Math.round(clipped.y1)
    );
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

// // Лассо
const LASSO_COLOR = '#0078d7';
const LASSO_FILL_OPACITY = 0.15; // для готового выделения
function drawLasso(points, currentX, currentY) {
    const toolsCanvas = dom.toolsCanvas;
    if (!toolsCanvas || points.length === 0) return;
    const ctx = toolsCanvas.getContext('2d');

    // Очищаем toolsCanvas перед рисованием
    ctx.clearRect(0, 0, toolsCanvas.width, toolsCanvas.height);

    ctx.strokeStyle = LASSO_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    ctx.setLineDash([]);
}
function drawLassoSelection(points) {
    const toolsCanvas = dom.toolsCanvas;
    if (!toolsCanvas || points.length < 2) return;
    const ctx = toolsCanvas.getContext('2d');

    // Очищаем toolsCanvas перед рисованием
    ctx.clearRect(0, 0, toolsCanvas.width, toolsCanvas.height);

    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = `rgba(0, 120, 215, ${LASSO_FILL_OPACITY})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
}
function drawLassoSelectionRED(points) {
    const toolsCanvas = dom.toolsCanvas;
    if (!toolsCanvas || points.length < 2) return;
    const ctx = toolsCanvas.getContext('2d');

    // Очищаем toolsCanvas перед рисованием
    ctx.clearRect(0, 0, toolsCanvas.width, toolsCanvas.height);

    ctx.strokeStyle = LASSO_COLOR;
    ctx.fillStyle = `rgba(0, 120, 215, ${LASSO_FILL_OPACITY})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
} 


            // Расчёт всех точек внутри полигона
            function calculatePointsInsidePolygon(Lpoints) {

                let points = [];
                for (let ii = 0; ii < Lpoints.length; ii++) {
                    points.push([Lpoints[ii].x, Lpoints[ii].y]);
                }

                
                // Очищаем массив внутренних точек
                let allPoints = [...points]; // Сначала добавляем контур

                // Получаем границы ROI
                let minX = Math.min(...points.map(p => p[0]));
                let maxX = Math.max(...points.map(p => p[0]));
                let minY = Math.min(...points.map(p => p[1]));
                let maxY = Math.max(...points.map(p => p[1]));


                
                // Проверяем каждый пиксель в ограничительном прямоугольнике
                for (let y = Math.floor(minY) - 1; y <= Math.ceil(maxY) + 1; y++) {
                    for (let x = Math.floor(minX) - 1; x <= Math.ceil(maxX) + 1; x++) {
                        // Преобразуем координаты canvas в координаты изображения

                        // Проверяем, что координаты в пределах изображения
                        //if (imgX >= 0 && imgY >= 0 && imgX < width && imgY < height) {
                            
                            // Проверяем, находится ли точка внутри полигона
                            if (isPointInPolygon(points,x, y)) {
                                
                                allPoints.push([x, y]); // Сохраняем координаты относительно изображения
                            }
                        //}
                    }
                }
                
               
                // Уникализация точек (удаление дубликатов)
                allPoints = [...new Set(allPoints.map(JSON.stringify))].map(JSON.parse);
                return allPoints;
            }
                        // Алгоритм точки внутри многоугольника (чётность-нечётность)
                        function isPointInPolygon(points,px, py) {
                            let inside = false;
                            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                                const [xi, yi] = points[i];
                                const [xj, yj] = points[j];
                                const intersect = (
                                    yi > py !== yj > py &&
                                    px < (xj - xi) * (py - yi) / (yj - yi) + xi
                                );
                                if (intersect) inside = !inside;
                            }
                            return inside;
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
// Расстояние от точки (px, py) до отрезка (x1,y1)-(x2,y2)
function distanceToSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = len_sq === 0 ? 0 : dot / len_sq;
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Отрисовка профиля и маркеров
function drawProfile(profile) {
    if (!profile) return;
    const toolsCanvas = dom.toolsCanvas;
    if (!toolsCanvas) return;
    const ctx = toolsCanvas.getContext('2d');

    // Очищаем toolsCanvas перед рисованием
    ctx.clearRect(0, 0, toolsCanvas.width, toolsCanvas.height);

    // Рисуем линию профиля
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(profile.x1, profile.y1);
    ctx.lineTo(profile.x2, profile.y2);
    ctx.stroke();

    // Рисуем концевые маркеры (синие кружки)
    ctx.fillStyle = '#0078d7';
    ctx.beginPath();
    ctx.arc(profile.x1, profile.y1, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(profile.x2, profile.y2, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Обновляем график
    updateGraph(profile.x1, profile.y1, profile.x2, profile.y2);
}
// Отрисовка линии профиля во время создания (красная линия + синие маркеры)
function drawProfileInProgress(x1, y1, x2, y2) {
    const toolsCanvas = dom.toolsCanvas;
    if (!toolsCanvas) return;
    const ctx = toolsCanvas.getContext('2d');

    // Очищаем toolsCanvas перед рисованием
    ctx.clearRect(0, 0, toolsCanvas.width, toolsCanvas.height);

    // Линия красным цветом
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Маркеры на концах (синие кружки)
    ctx.fillStyle = '#0078d7';
    ctx.beginPath();
    ctx.arc(x1, y1, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y2, 5, 0, 2 * Math.PI);
    ctx.fill();
}