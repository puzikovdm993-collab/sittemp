class ROIRectNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Прямоугольник";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg"
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);

        
        this.addInput("Image", Types.IMAGE);

        this.addOutput("Image", Types.IMAGE);
        this.addOutput("Points", Types.POINTS);

        // Прямоугольник в координатах изображения:
        // { x, y, w, h }
        this.rect = null;
        this.properties.rect = null;


        // Точка начала рисования
        this.start = null;

        this.isDrawing = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.selected = false;

        // ImageData для отрисовки
        this.img = null;

        // Исходные данные входного selectRectangle, если он подключен
        this.inputRectData = null;

        // Смещение изображения внутри узла
        this.beginx = 25;
        this.beginy = 65;

        // Высота зоны под изображением для текста
        this.infoHeight = 18;

        // Формат входного прямоугольника:
        // "xywh" => [x, y, w, h]
        // "xyxy" => [x1, y1, x2, y2]
        this.rectFormat = "xywh";

        this.properties = this.properties || {};

        this.resizable = false;
        this.size = [180, 160];
    }

    _hasInputRect() {
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

    // Нормализация входного прямоугольника.
    // Поддерживает:
    // 1) [x, y, w, h]
    // 2) [x1, y1, x2, y2], если this.rectFormat = "xyxy"
    // 3) { x, y, w, h }
    // 4) { x, y, width, height }
    _normalizeRect(value) {
        if (!value) return null;

        let x, y, w, h;

        if (Array.isArray(value) && value.length >= 4) {
            const [a, b, c, d] = value.map(Number);

            if (this.rectFormat === "xyxy") {
                x = Math.min(a, c);
                y = Math.min(b, d);
                w = Math.abs(c - a);
                h = Math.abs(d - b);
            } else {
                x = a;
                y = b;
                w = c;
                h = d;
            }
        } else if (typeof value === "object") {
            x = Number(value.x);
            y = Number(value.y);
            w = Number(value.w ?? value.width);
            h = Number(value.h ?? value.height);
        } else {
            return null;
        }

        if (![x, y, w, h].every(Number.isFinite)) {
            return null;
        }

        if (w < 0) {
            x += w;
            w = -w;
        }

        if (h < 0) {
            y += h;
            h = -h;
        }

        return {
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(h)
        };
    }

    // Приводит прямоугольник к границам изображения
    _clampRectToImage(rect) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!rect || !w || !h) return null;

        const x = Math.max(0, Math.min(rect.x, w));
        const y = Math.max(0, Math.min(rect.y, h));

        const rw = Math.max(0, Math.min(rect.w, w - x));
        const rh = Math.max(0, Math.min(rect.h, h - y));

        return {
            x,
            y,
            w: rw,
            h: rh
        };
    }

    // Проверяем, попал ли клик в существующий прямоугольник
    _hitRect(p) {
        if (!this.rect) return false;

        const margin = 1;

        return (
            p.x >= this.rect.x - margin &&
            p.x <= this.rect.x + this.rect.w + margin &&
            p.y >= this.rect.y - margin &&
            p.y <= this.rect.y + this.rect.h + margin
        );
    }

    // Обновляем прямоугольник при рисовании от this.start до p
    _updateRectFromStart(p) {
        const x1 = Math.round(Math.min(this.start.x, p.x));
        const y1 = Math.round(Math.min(this.start.y, p.y));
        const x2 = Math.round(Math.max(this.start.x, p.x));
        const y2 = Math.round(Math.max(this.start.y, p.y));

        this.rect = {
            x: x1,
            y: y1,
            w: x2 - x1,
            h: y2 - y1
        };
        this.properties.rect= {
            x: x1,
            y: y1,
            w: x2 - x1,
            h: y2 - y1
        };
    }

    // Перемещаем существующий прямоугольник
    _moveRect(p) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!this.rect) return;

        const nx = this._clamp(
            p.x - this.dragOffset.x,
            0,
            Math.max(0, w - this.rect.w)
        );

        const ny = this._clamp(
            p.y - this.dragOffset.y,
            0,
            Math.max(0, h - this.rect.h)
        );

        this.rect.x = Math.round(nx);
        this.rect.y = Math.round(ny);

        this.properties.rect.x = Math.round(nx);
        this.properties.rect.y = Math.round(ny);
    }

    // Отрисовка параметров выделенной области под изображением
    _drawRectInfo(ctx) {
        // const rect = this.rect;
        const rect = this.properties.rect;

        const text = rect && rect.w > 0 && rect.h > 0
            ? `x: ${rect.x}  y: ${rect.y}  w: ${rect.w}  h: ${rect.h}`
            : "x: -  y: -  w: -  h: -";

        ctx.save();

        ctx.font = "12px monospace";
        ctx.fillStyle = "#e5e7eb";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        const x = this.beginx;
        const y = this.beginy + this.properties.height + 6;

        ctx.fillText(text, x, y);

        ctx.restore();
    }

    // Текст рисуется поверх узла, чтобы он был виден
    onDrawForeground(ctx) {
        if (!this.img) return;
        if (!this.properties?.width || !this.properties?.height) return;

        this._drawRectInfo(ctx);
    }

    onMouseDown(event, pos) {
        // Если входной selectRectangle подключен,
        // узел только отображает и передает входную область.
        if (this._hasInputRect()) {
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

        // Если кликнули по существующему прямоугольнику — перемещаем.
        // Shift позволяет начать новый прямоугольник поверх старого.
        if (this.rect && !event?.shiftKey && this._hitRect(p)) {
            this.isDragging = true;
            this.dragOffset = {
                x: p.x - this.rect.x,
                y: p.y - this.rect.y
            };
            this.selected = true;
            return true;
        }

        // Иначе начинаем рисовать новый прямоугольник
        this.isDrawing = true;
        this.start = p;
        this.rect = {
            x: p.x,
            y: p.y,
            w: 0,
            h: 0
        };
        this.properties.rect = {
            x: p.x,
            y: p.y,
            w: 0,
            h: 0
        };
        this.selected = false;

        return true;
    }

    onMouseMove(event, pos) {
        // Если входной selectRectangle подключен,
        // ручное изменение области запрещено.
        if (this._hasInputRect()) {
            return;
        }

        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!w || !h) return;

        const p = this._clampImagePoint(this._toImage(pos));

        if (this.isDrawing) {
            this._updateRectFromStart(p);
            this.graph?.setDirtyCanvas("bg");
        } else if (this.isDragging) {
            this._moveRect(p);
            this.graph?.setDirtyCanvas("bg");
        }
    }

    onMouseUp() {
        // Если входной selectRectangle подключен,
        // не завершаем ручное рисование.
        if (this._hasInputRect()) {
            return;
        }

        if (this.isDrawing) {
            this.isDrawing = false;

            // Если прямоугольник слишком маленький — сбрасываем
            if (!this.rect || this.rect.w < 1 || this.rect.h < 1) {
                this.rect = null;
            }
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
        this.size[1] = this.properties.height + this.beginy + this.beginx + this.infoHeight;

        if (this.rect && this.rect.w > 0 && this.rect.h > 0) {
            const x = this.beginx + this.rect.x;
            const y = this.beginy + this.rect.y;

            const isInputRect = this._hasInputRect();

            // Входной прямоугольник можно выделить другим цветом,
            // например зеленым.
            ctx.strokeStyle = isInputRect
                ? "#22c55e"
                : (this.isDragging || this.selected ? "red" : "#4a9eff");

            ctx.lineWidth = 1;

            ctx.strokeRect(x + 0.5, y + 0.5, this.rect.w, this.rect.h);

            ctx.fillStyle = isInputRect
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(133, 189, 255, 0.15)";

            ctx.fillRect(x, y, this.rect.w, this.rect.h);
        }
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

        const inputRectData = this.getInputData(1);
        this.inputRectData = null;

        if (this._hasInputRect()) {
            // Входной selectRectangle подключен:
            // используем его для отображения и передаем дальше.
            const rect = this._normalizeRect(inputRectData);

            if (rect) {
                // Для отображения приводим к границам изображения.
                this.rect = this._clampRectToImage(rect) || rect;

                // Для выхода передаем исходные входные данные.
                this.inputRectData = inputRectData;
            } else {
                this.rect = null;
            }
        } else {
            // Если вход не подключен, используем вручную нарисованный прямоугольник.
            if (this.rect) {
                this.rect = this._clampRectToImage(this.rect) || null;
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

        // Выход selectRectangle.
        if (this._hasInputRect()) {
            // Если вход подключен — передаем входной прямоугольник дальше.
            this.setOutputData(1, this.inputRectData);
        } else if (this.rect && this.rect.w > 0 && this.rect.h > 0) {

            this.properties._x = this.rect.x;
            this.properties._y = this.rect.y;
            this.properties._w = this.rect.w;
            this.properties._h = this.rect.h;

            const rois = {
                    left:   this.rect.x,
                    top:    this.rect.y,
                    right:  this.rect.x + this.rect.w,
                    bottom: this.rect.y + this.rect.h 
                } ;

            
            const pts = [];
            for (let y = rois.top; y < rois.bottom; y++) {
                for (let x = rois.left; x < rois.right; x++) {
                    pts.push([x, y]);
                }
            }
            console.log("pts = ", pts);
            const contour = [
                [rois.left,rois.top],
                [rois.right,rois.top],
                [rois.right,rois.bottom],
                [rois.left,rois.bottom]
            ] ;
            console.log("contour = ", contour);

            // Если вход не подключен — передаем нарисованный прямоугольник.
            this.setOutputData(1, 
                {
                    points: pts,
                    contour: contour
                }
            );


        } else {
            this.setOutputData(1, null);
        }

        if (!w || !h) return;

        // Отрисовка превью изображения
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

LiteGraph.registerNodeType("roi/rectangle", ROIRectNode);
