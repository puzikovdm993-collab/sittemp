class ROILassoNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Лассо";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg"
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);

        
        this.addInput("Image", Types.IMAGE);

        this.addOutput("Image", Types.IMAGE);
        this.addOutput("Points", Types.POINTS); 

        this.properties = this.properties || {};

        // Контур в координатах изображения:
        // [[x, y], [x, y], ...]
        this.points = Array.isArray(this.properties.points)
            ? this.properties.points
            : [];

        this.properties.points = this.points;

        this.start = null;
        this.isDrawing = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.selected = false;

        this.img = null;

        // Исходные данные входного selectLasso, если он подключен
        this.inputLassoData = null;

        // Смещение изображения внутри узла
        this.beginx = 25;
        this.beginy = 65;

        // Высота зоны под изображением для текста
        this.infoHeight = 18;

        // Минимальное расстояние между точками контура, px
        this.minPointDistance = 2;

        this.resizable = false;
        this.size = [180, 160];
    }

    _hasInputLasso() {
        return this.inputs?.[1]?.link != null;
    }

    _clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    // Перевод координат мыши из координат узла в координаты изображения
    _toImage(pos) {
        return {
            x: pos[0] - this.beginx,
            y: pos[1] - this.beginy
        };
    }

    _isInsideImage(p) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        return p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
    }

    _clampImagePoint(p) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        return {
            x: this._clamp(p.x, 0, w),
            y: this._clamp(p.y, 0, h)
        };
    }

    // Вычисляет bounding box для массива точек
    _bbox(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0, w: 0, h: 0 };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const [x, y] of points) {
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
            return { x: 0, y: 0, w: 0, h: 0 };
        }

        return {
            x: Math.round(minX),
            y: Math.round(minY),
            w: Math.round(maxX - minX),
            h: Math.round(maxY - minY)
        };
    }

    // Нормализует массив точек.
    // Поддерживает:
    // 1) [[x, y], [x, y], ...]
    // 2) [{x, y}, {x, y}, ...]
    // 3) [x1, y1, x2, y2, ...]
    _normalizePointArray(arr) {
        if (!Array.isArray(arr)) return null;

        const toPoint = (p) => {
            if (Array.isArray(p) && p.length >= 2) {
                return [Number(p[0]), Number(p[1])];
            }

            if (p && typeof p === "object") {
                return [Number(p.x), Number(p.y)];
            }

            return null;
        };

        // Плоский массив: [x1, y1, x2, y2, ...]
        if (
            arr.length >= 6 &&
            arr.length % 2 === 0 &&
            arr.every((v) => Number.isFinite(Number(v)))
        ) {
            const points = [];

            for (let i = 0; i < arr.length; i += 2) {
                points.push([Number(arr[i]), Number(arr[i + 1])]);
            }

            return points;
        }

        // Массив точек: [[x, y], ...] или [{x, y}, ...]
        const points = arr.map(toPoint).filter(Boolean);

        return points.length ? points : null;
    }

    // Нормализует входной lasso.
    // Поддерживает:
    // 1) [[x, y], ...]
    // 2) [{x, y}, ...]
    // 3) [x1, y1, x2, y2, ...]
    // 4) { points: [[x, y], ...] }
    // 5) { x: [...], y: [...] }
    _normalizeLasso(value) {
        if (!value) return null;

        let raw = null;

        if (Array.isArray(value)) {
            raw = this._normalizePointArray(value);
        } else if (typeof value === "object") {
            if (Array.isArray(value.points)) {
                raw = this._normalizePointArray(value.points);
            } else if (Array.isArray(value.x) && Array.isArray(value.y)) {
                raw = value.x
                    .map((x, i) => [Number(x), Number(value.y[i])])
                    .filter(Boolean);
            }
        }

        if (!raw || raw.length < 3) return null;

        raw = raw.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

        if (raw.length < 3) return null;

        return raw.map(([x, y]) => [Math.round(x), Math.round(y)]);
    }

    // Приводит контур к границам изображения
    _clampLassoToImage(points) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!points || !w || !h) return null;

        return points.map(([x, y]) => [
            this._clamp(x, 0, w),
            this._clamp(y, 0, h)
        ]);
    }

    // Проверяем, попал ли клик внутрь существующего контура
    _hitLasso(p) {
        if (!this.points || this.points.length < 3) return false;

        let inside = false;

        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            const xi = this.points[i][0];
            const yi = this.points[i][1];
            const xj = this.points[j][0];
            const yj = this.points[j][1];

            if (
                ((yi > p.y) !== (yj > p.y)) &&
                (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi)
            ) {
                inside = !inside;
            }
        }

        return inside;
    }

    // Добавляет точку при рисовании
    _addPoint(p) {
        const last = this.points[this.points.length - 1];

        if (!last) return;

        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < this.minPointDistance) {
            return;
        }

        this.points.push([Math.round(p[0]), Math.round(p[1])]);
        this.properties.points = this.points.map(([x, y]) => [x, y]);
    }

    // Перемещает существующий контур
    _moveLasso(p) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!this.points || this.points.length < 3 || !w || !h) return;

        const bbox = this._bbox(this.points);

        const desiredFirst = {
            x: p.x - this.dragOffset.x,
            y: p.y - this.dragOffset.y
        };

        let dx = desiredFirst.x - this.points[0][0];
        let dy = desiredFirst.y - this.points[0][1];

        const minX = bbox.x + dx;
        const maxX = bbox.x + bbox.w + dx;

        if (minX < 0) dx += -minX;
        if (maxX > w) dx -= maxX - w;

        const minY = bbox.y + dy;
        const maxY = bbox.y + bbox.h + dy;

        if (minY < 0) dy += -minY;
        if (maxY > h) dy -= maxY - h;

        this.points = this.points.map(([x, y]) => [
            Math.round(x + dx),
            Math.round(y + dy)
        ]);

        this.properties.points = this.points.map(([x, y]) => [x, y]);
    }

    // Отрисовка параметров выделенной области под изображением
    _drawLassoInfo(ctx) {
        const points = this.points || [];
        const bbox = this._bbox(points);

        const text = points.length >= 3
            ? `points: ${points.length}  x: ${bbox.x}  y: ${bbox.y}  w: ${bbox.w}  h: ${bbox.h}`
            : "points: -  x: -  y: -  w: -  h: -";

        ctx.save();

        ctx.font = "12px monospace";
        ctx.fillStyle = "#e5e7eb";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        const x = this.beginx;
        const y = this.beginy + (this.properties?.height || 0) + 6;

        ctx.fillText(text, x, y);

        ctx.restore();
    }

    // Текст рисуется поверх узла, чтобы он был виден
    onDrawForeground(ctx) {
        if (!this.img) return;
        if (!this.properties?.width || !this.properties?.height) return;

        this._drawLassoInfo(ctx);
    }

    onMouseDown(event, pos) {
        // Если входной selectLasso подключен,
        // узел только отображает и передает входную область.
        if (this._hasInputLasso()) {
            return false;
        }

        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!w || !h) return false;

        const raw = this._toImage(pos);

        // Клик вне изображения игнорируем
        if (!this._isInsideImage(raw)) {
            return false;
        }

        const p = this._clampImagePoint(raw);

        // Если кликнули внутрь существующего контура — перемещаем.
        // Shift позволяет начать новый контур поверх старого.
        if (this.points.length >= 3 && !event?.shiftKey && this._hitLasso(p)) {
            this.isDragging = true;
            this.dragOffset = {
                x: p.x - this.points[0][0],
                y: p.y - this.points[0][1]
            };
            this.selected = true;
            return true;
        }

        // Иначе начинаем рисовать новый контур
        this.isDrawing = true;
        this.start = p;
        this.points = [[Math.round(p.x), Math.round(p.y)]];
        this.properties.points = [[Math.round(p.x), Math.round(p.y)]];
        this.selected = false;

        return true;
    }

    onMouseMove(event, pos) {
        // Если входной selectLasso подключен,
        // ручное изменение области запрещено.
        if (this._hasInputLasso()) {
            return;
        }

        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!w || !h) return;

        const p = this._clampImagePoint(this._toImage(pos));

        if (this.isDrawing) {
            this._addPoint([p.x, p.y]);
            this.graph?.setDirtyCanvas("bg");
        } else if (this.isDragging) {
            this._moveLasso(p);
            this.graph?.setDirtyCanvas("bg");
        }
    }

    onMouseUp() {
        // Если входной selectLasso подключен,
        // не завершаем ручное рисование.
        if (this._hasInputLasso()) {
            return;
        }

        if (this.isDrawing) {
            this.isDrawing = false;

            // Если последняя точка почти совпадает с первой — убираем дубль
            if (this.points.length > 3) {
                const first = this.points[0];
                const last = this.points[this.points.length - 1];

                if (
                    Math.hypot(last[0] - first[0], last[1] - first[1]) <
                    this.minPointDistance
                ) {
                    this.points.pop();
                }
            }

            // Если контур слишком маленький — сбрасываем
            if (this.points.length < 3) {
                this.points = [];
            }

            this.properties.points = this.points.map(([x, y]) => [x, y]);
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.selected = false;
        }

        this.graph?.setDirtyCanvas("bg");
    }

    onDrawBackground(ctx) {
        if (!this.img) return;

        const tmp = document.createElement("canvas");
        tmp.width = this.properties.width;
        tmp.height = this.properties.height;

        tmp.getContext("2d").putImageData(this.img, 0, 0);

        ctx.drawImage(
            tmp,
            this.beginx,
            this.beginy,
            this.properties.width,
            this.properties.height
        );

        this.size[0] = this.properties.width + this.beginx * 2;

        // Добавляем место под текст с параметрами области
        this.size[1] =
            this.properties.height + this.beginy + this.beginx + this.infoHeight;

        if (this.points && this.points.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(
                this.beginx + this.points[0][0],
                this.beginy + this.points[0][1]
            );

            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(
                    this.beginx + this.points[i][0],
                    this.beginy + this.points[i][1]
                );
            }

            ctx.closePath();

            const isInputLasso = this._hasInputLasso();

            // Входной контур можно выделить другим цветом,
            // например зеленым.
            ctx.strokeStyle = isInputLasso
                ? "#22c55e"
                : (this.isDragging || this.selected ? "red" : "#4a9eff");

            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = isInputLasso
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(133, 189, 255, 0.15)";

            ctx.fill();
        }
    }

    // Возвращает массив [x, y] всех пикселей внутри контура
    _getPointsInsideLasso() {
        if (!this.points || this.points.length < 3) return [];

        const bbox = this._bbox(this.points);
        const result = [];

        for (let y = bbox.y; y <= bbox.y + bbox.h; y++) {
            for (let x = bbox.x; x <= bbox.x + bbox.w; x++) {
                if (this._pointInPolygon(x, y)) {
                    result.push([x, y]);
                }
            }
        }

        return result;
    }

    // Ray-casting: точка (px, py) внутри полигона?
    _pointInPolygon(px, py) {
        const pts = this.points;
        let inside = false;

        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1];
            const xj = pts[j][0], yj = pts[j][1];

            if (
                ((yi > py) !== (yj > py)) &&
                (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            ) {
                inside = !inside;
            }
        }

        return inside;
    }





    
    onExecute() {
        const inputData = this.getInputData(0);
        if (!inputData) return;

        this.properties.width = inputData.width;
        this.properties.height = inputData.height;
        this.properties.data = inputData.data;
        this.properties.minValue = inputData.minValue;
        this.properties.maxValue = inputData.maxValue;
        this.properties.autoscale = inputData.autoscale;
        this.properties.colormap = inputData.colormap;
        this.properties.filename = inputData.filename;
        this.properties.format = inputData.format;

        const w = this.properties.width;
        const h = this.properties.height;

        const inputLassoData = this.getInputData(1);
        this.inputLassoData = null;

        if (this._hasInputLasso()) {
            // Входной selectLasso подключен:
            // используем его для отображения и передаем дальше.
            const points = this._normalizeLasso(inputLassoData.contour);

            if (points) {
                // Для отображения приводим к границам изображения.
                this.points = this._clampLassoToImage(points) || points;
          
                this.properties.points = this.points.map(([x, y]) => [x, y]);

                // Для выхода передаем исходные входные данные.
                this.inputLassoData = inputLassoData;
            } else {
                this.points = [];
                this.properties.points = [];
            }
        } else {
            // Если вход не подключен, используем вручную нарисованный контур.
            if (this.points && this.points.length >= 3) {
                this.points = this._clampLassoToImage(this.points) || [];
                this.properties.points = this.points.map(([x, y]) => [x, y]);
            }
        }

        const outputData = {
            width: this.properties.width,
            height: this.properties.height,
            data: this.properties.data,
            minValue: this.properties.minValue,
            maxValue: this.properties.maxValue,
            format: this.properties.format,
            filename: this.properties.filename,
            autoscale: this.properties.autoscale,
            colormap: this.properties.colormap
        };

        this.setOutputData(0, outputData);

        // Выход selectLasso.
        if (this._hasInputLasso()) {
            // Если вход подключен — передаем входной lasso дальше.
            this.setOutputData(1, this.inputLassoData);
        } else if (this.points && this.points.length >= 3) {
            const insidePoints = this._getPointsInsideLasso();
            // console.log("insidePoints = ",insidePoints);
             this.properties._points = insidePoints;
            
// points = [[x, y], [x, y], [x, y], [x, y], [x, y]];
            // console.log(insidePoints);
            // console.log(this.points);

            this.setOutputData(1,
                {
                    points: insidePoints,
                    contour:this.points
                }
            );
        } else {
            this.setOutputData(1, null);
        }

        if (!w || !h) return;

        // Отрисовка превью изображения
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");

        tempCanvas.width = w;
        tempCanvas.height = h;

        const colorMap = (typeof getColormap === "function")
            ? getColormap(this.properties.colormap)
            : (v => ({ r: v, g: v, b: v }));

        const data = new Uint8ClampedArray(w * h * 4);
        let dataIndex = 0;

        const min = Number.isFinite(this.properties.minValue)
            ? this.properties.minValue
            : 0;

        const max = Number.isFinite(this.properties.maxValue)
            ? this.properties.maxValue
            : 1;

        const range = max - min + 1e-9;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const value = this.properties.data?.[y]?.[x] ?? 0;

                let normalizedValue = (value - min) / range;
                if (!Number.isFinite(normalizedValue)) normalizedValue = 0;

                const c = colorMap(Math.max(0, Math.min(1, normalizedValue)));

                // Поддерживаем и объект { r, g, b }, и массив [r, g, b]
                const r = Array.isArray(c) ? c[0] : (c?.r ?? 0);
                const g = Array.isArray(c) ? c[1] : (c?.g ?? 0);
                const b = Array.isArray(c) ? c[2] : (c?.b ?? 0);

                data[dataIndex++] = r * 255;
                data[dataIndex++] = g * 255;
                data[dataIndex++] = b * 255;
                data[dataIndex++] = 255;
            }
        }

        const imageData = new ImageData(data, w, h);
        tempCtx.putImageData(imageData, 0, 0);

        const out = tempCtx.getImageData(0, 0, w, h);

        this.properties.previewData = out;
        this.img = out;
    }
}

LiteGraph.registerNodeType("roi/lasso", ROILassoNode);
