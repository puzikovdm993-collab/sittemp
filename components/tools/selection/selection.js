"use strict";

//--- Константы конфигурации ---
const LASSO_CONFIG={
    SELECT_COLOR: '#5ABAFF80',
    SELECT_FILL_OPACITY: 0.25,
    STROKE_COLOR: '#333',
    STROKE_LINE_WIDTH: 1.5,
    STROKE_LINE_DASH: [6,4]
};


let currentSelection = [];

let collectionSelection = {
    polygons: [],
    pixels: []
};


let historySelection = [];
let historyIndexSelection = -1;


/**
 * Клонирование геометрии
 */
 function cloneSelectionPolygon(value) {

    return value.map(
        polygon =>
            polygon.map(
                ring =>
                    ring.map(
                        point => [
                            point[0],
                            point[1]
                        ]
                    )
            )
    );
}

/**
 * Сохранение состояния в историю
 */
function saveHistorySelection() {
    const snapshot = {

        polygon: cloneSelectionPolygon(collectionSelection.polygon),

        mask: collectionSelection.mask ? collectionSelection.mask.slice() : null,

        pixels: collectionSelection.pixels ? structuredClone(collectionSelection.pixels) : null,

        bounds: collectionSelection.bounds ? {...collectionSelection.bounds} : null

    };
    // ======================================================
    // Если мы сделали Undo, а потом создали новое действие — 
    // старый Redo больше недействителен.
    // Например:
    // A → B → C
    //  Undo
    // A → B
    // Новое действие D
    // A → B → D
    // C удаляется из истории.
    // ======================================================
    
    if (historyIndexSelection < historySelection.length - 1) {
        historySelection = historySelection.slice( 0, historyIndexSelection + 1);
    }

    // Добавляем новое состояние
    historySelection.push(snapshot);

    // Переходим на него
    historyIndexSelection = historySelection.length - 1;
}

function restoreHistory(index) {
    if (index < 0 || index >= historySelection.length) { return; }
    historyIndexSelection = index;
    collectionSelection = cloneSelection(
        historySelection[historyIndexSelection]
    );
    redraw();
}

// ======================================================
// UNDO
// ======================================================
function undoSelection() {
    if (historyIndexSelection <= 0) { return; }
    restoreHistory( historyIndexSelection - 1 );
}

// ======================================================
// REDO
// ======================================================
function redoSelection() {
    if (historyIndexSelection >= historySelection.length - 1) {return;}
    restoreHistory(historyIndexSelection + 1);
}

// ======================================================
// ОЧИСТКА ИСТОРИИ
// ======================================================
function resetHistorySelection() {
    historySelection = [];
    historyIndexSelection = -1;
    // Первое состояние — пустое выделение
    collectionSelection = [];
    saveHistorySelection();
}

// ======================================================
// { x, y } -> [x, y]
// ======================================================

function toPolygon(shape) {
    return shape.map(point => [point.x, point.y]);
}


// ======================================================
// ПРИМЕНЕНИЕ ОПЕРАЦИИ
// ======================================================
function applyOperationSelection(lasso, operation) {
    if (lasso.length < 3) { return; }
    const polygon = [toPolygon(lasso)];

    if (operation === 'REPLACE') { 
        collectionSelection.polygons = [polygon]
    } 
    else if (!collectionSelection.polygons.length) {
        collectionSelection.polygons = polygon
    }
    else if (operation === 'UNION') {
        collectionSelection.polygons  = polygonClipping.union(collectionSelection.polygons, polygon);

    } 
    else if (operation === 'DIFFERENCE') {
    
        collectionSelection.polygons  = polygonClipping.difference(collectionSelection.polygons, polygon);
    
    } 
    else if (operation === 'INTERSECTION') {
    
        collectionSelection.polygons  = polygonClipping.intersection(collectionSelection.polygons, polygon);
    
    }
    updateSelection(collectionSelection.polygons);
    //saveHistorySelection();
}

// ======================================================
// РИСОВАНИЕ РЕЗУЛЬТАТА
// ======================================================
function drawPolygons(ctx, polygons) {
    if (!polygons || !polygons.length) {return;}
    ctx.beginPath();
    for (const polygon of polygons) {
        for (const ring of polygon) {    
            if (!ring.length) {continue;}
            ctx.moveTo(ring[0][0]* zoom, ring[0][1]* zoom);
            for (let i = 1; i < ring.length; i++) {
                ctx.lineTo(ring[i][0]* zoom, ring[i][1]* zoom);
            }
            ctx.closePath();
        }
    }
    ctx.fillStyle = LASSO_CONFIG.SELECT_COLOR;
    ctx.fill('evenodd');
}

// ======================================================
// ТЕКУЩЕЕ ВЫДЕЛЕНИЕ
// ======================================================
function drawCurrentSelection(ctx) {
    if (currentSelection.length < 1) {return;}

    ctx.beginPath();
    ctx.moveTo(currentSelection[0].x* zoom, currentSelection[0].y* zoom);
    for (let i = 1; i < currentSelection.length; i++) {
        ctx.lineTo(currentSelection[i].x* zoom, currentSelection[i].y* zoom);
    }
    ctx.strokeStyle = LASSO_CONFIG.STROKE_COLOR;
    ctx.lineWidth = LASSO_CONFIG.STROKE_LINE_WIDTH;
    ctx.setLineDash(LASSO_CONFIG.STROKE_LINE_DASH);
    ctx.stroke();
    ctx.setLineDash([]);
}

// ======================================================
// ПЕРЕРИСОВКА
// ======================================================
function redrawClear() {
    const overlayCanvas = document.getElementById('overlayCanvas');
    overlayCanvas.style.imageRendering= 'pixelated';
    if (!overlayCanvas) return;
    const canvasHost = document.getElementById('canvasHost');
    if (canvasHost) {
        overlayCanvas.width = canvasHost.offsetWidth;
        overlayCanvas.height = canvasHost.offsetHeight;
    }
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

}
function redraw() {
    const overlayCanvas = document.getElementById('overlayCanvas');
    overlayCanvas.style.imageRendering= 'pixelated';
    if (!overlayCanvas) return;
    const canvasHost = document.getElementById('canvasHost');
    if (canvasHost) {
        overlayCanvas.width = canvasHost.offsetWidth;
        overlayCanvas.height = canvasHost.offsetHeight;
    }
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);


    drawPolygons(ctx, collectionSelection.polygons);

    switch (currentTool) {
        case 'lasso':
            drawCurrentSelection(ctx);
            break;
        case 'rectangle':
            if (currentSelection.length < 1) {break;}
            ctx.strokeStyle = '#0078d7';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(currentSelection[0].x, currentSelection[0].y, currentSelection[1].x - currentSelection[0].x, currentSelection[1].y - currentSelection[0].y);
            ctx.setLineDash([]);
            break;
    }
    
}

// ======================================================
// ОПРЕДЕЛЕНИЕ ОПЕРАЦИИ
// ======================================================
function getOperation(event) {

    // Ctrl + Shift
    if (event.ctrlKey && event.shiftKey) { return 'DIFFERENCE';}

    // Ctrl
    if (event.ctrlKey) { return 'UNION'; }

    // Shift
    if (event.shiftKey) { return 'INTERSECTION'; }

    // Обычное выделение
    return 'REPLACE';
}







function handleMouseDownSelection(){
    currentSelection = [];
    const point = {x: startX, y: startY};
    currentSelection.push(point);
}

function handleMouseMoveSelection(e,coords) {
    
    switch (currentTool) {
        case 'lasso':
            const point = {x: coords.x, y: coords.y};
            currentSelection.push(point);
            break;
        case 'rectangle':
            currentSelection = [];
            const point1 = {x: startX, y: startY};
            currentSelection.push(point1);
            const point2 = {x: coords.x, y: coords.y};
            currentSelection.push(point2);
            break;
    }
    redraw();
}

function handleMouseUpSelection(e,coords) {
    if (currentSelection.length < 2) {
        console.log(currentSelection.length)
        currentSelection = [];
        redrawClear();
        return;
    }
    const operation = getOperation(e);
    
    switch (currentTool) {
        case 'rectangle':
            currentSelection = [];
            const point1 = { x: startX, y: startY };
            currentSelection.push(point1);
            const point3 = { x: startX, y: coords.y };
            currentSelection.push(point3);
            const point2 = { x: coords.x, y: coords.y };
            currentSelection.push(point2);
            const point4 = { x: coords.x, y: startY };
            currentSelection.push(point4);
            break;
    }



    applyOperationSelection(currentSelection,operation);

    currentSelection = [];
    redraw();
}










// ======================================================
// ОБНОВЛЕНИЕ ВЫДЕЛЕНИЯ
// ======================================================
function updateSelection(polygons){

    if (!polygons || !polygons.length) {
        collectionSelection.pixels = [];
        return;
    }
    collectionSelection.pixels = [];
    for (const polygon of polygons) {
        collectionSelection.pixels.push(...extractPixels(polygon));
    }
}

// ======================================================
// ИЗВЛЕЧЕНИЕ ПИКСЕЛЕЙ ВЫДЕЛЕНИЯ
// ======================================================
function extractPixels(polygon){
    const canvas =  document.getElementById('overlayCanvas');
    const ctx =  canvas.getContext('2d');
    const bounds = getSelectionBounds(polygon);
    const mask = createSelectionMask(ctx, polygon, canvas.width, canvas.height);

    if (!bounds || bounds.width <= 0 || bounds.height <= 0 || isNaN(bounds.x) || isNaN(bounds.y) || isNaN(bounds.width) || isNaN(bounds.height)) {return [];}

    const pixels = [];

    for(let y = 0; y < bounds.height; y++){
        for(let x = 0; x < bounds.width; x++){
            const maskX = bounds.x + x;
            const maskY = bounds.y + y;
            const id = maskY * canvas.width + maskX;

            if(mask[id]){
                pixels.push([maskX,maskY]);
            }
        }
    }
    return pixels;
}

// ======================================================
// СОЗДАНИЕ МАСКИ ВЫДЕЛЕНИЯ
// ======================================================
function createSelectionMask(ctx,polygon, width, height) {
    const mask = new Uint8Array( width * height );
    const path = new Path2D();

    for (const ring of polygon) {
        path.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) {
            path.lineTo(ring[i][0], ring[i][1]);
        }
        path.closePath();
    }

    const bounds = getSelectionBounds(polygon);

    const startX = Math.max(0, bounds.x);
    const startY = Math.max(0, bounds.y);
    const endX = Math.min(width, bounds.x + bounds.width);
    const endY = Math.min(height, bounds.y + bounds.height);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            if (ctx.isPointInPath(path, x + 0.5, y + 0.5, "evenodd")) {
                mask[y * width + x] = 255;
            }
        }
    }
    return mask;
}

// ======================================================
// ПОЛУЧЕНИЕ ОГРАНИЧИВАЮЩЕГО ПРЯМОУГОЛЬНИКА
// ======================================================
function getSelectionBounds(polygon) {
    // Проверка на пустой полигон
    if (!polygon || polygon.length === 0) { return { x: 0, y: 0, width: 0, height: 0 }; }

    let minX = Infinity;
    let minY = Infinity;

    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const part of polygon) {
        for (const p of part) {
            minX = Math.min(minX, p[0]);
            minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]);
            maxY = Math.max(maxY, p[1]);
        }
    }

    // Если координаты не были установлены
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) { return { x: 0, y: 0, width: 0, height: 0 }; }
    return { x: Math.floor(minX), y: Math.floor(minY), width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) };
}

