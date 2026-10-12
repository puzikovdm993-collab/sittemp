class ROILassoViewerNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Просмотр ROI";

        this.addInput("Image", Types.IMAGE);
        this.addInput("Points", Types.POINTS);

        this.addOutput("Image", Types.IMAGE);
        this.addOutput("Points", Types.POINTS);

        this.properties = this.properties || {};

        this.beginx = 25;
        this.beginy = 65;
        this.infoHeight = 18;

        this.size = [180, 160];

        this.img = null;
        this.previewCanvas = null;
        this.maskCanvas = null;

        this.contour = [];
        this.points = [];
        this.bbox = { x: 0, y: 0, w: 0, h: 0 };
        this.inputLassoData = null;
    }

    _hasInputLasso() {
        return this.inputs?.[1]?.link != null;
    }

    _clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

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

    _clampLassoToImage(points) {
        const w = this.properties?.width || 0;
        const h = this.properties?.height || 0;

        if (!points || !w || !h) return null;

        return points.map(([x, y]) => [
            this._clamp(x, 0, w),
            this._clamp(y, 0, h)
        ]);
    }

    _prepareLasso(lassoData, w, h) {
        this.contour = [];
        this.points = [];
        this.maskCanvas = null;

        if (!lassoData) return;

        let contour = null;

        if (Array.isArray(lassoData)) {
            contour = this._normalizeLasso(lassoData);
        } else if (typeof lassoData === "object") {
            if (lassoData.contour) {
                contour = this._normalizeLasso(lassoData.contour);
            }

            if (!contour && lassoData.points) {
                const pts = this._normalizeLasso(lassoData.points);
                if (pts) {
                    this.points = pts;
                }
            }

            if (!contour && !this.points.length) {
                const pts = this._normalizeLasso(lassoData);
                if (pts) {
                    contour = pts;
                }
            }
        }

        if (contour) {
            this.contour = (w && h)
                ? (this._clampLassoToImage(contour) || contour)
                : contour;
            return;
        }

        // Если контура нет, а есть список точек/пикселей — рисуем маску.
        if (this.points.length && w && h) {
            const maskData = new Uint8ClampedArray(w * h * 4);

            for (const [x, y] of this.points) {
                if (x >= 0 && x < w && y >= 0 && y < h) {
                    const i = (y * w + x) * 4;
                    maskData[i] = 34;
                    maskData[i + 1] = 197;
                    maskData[i + 2] = 94;
                    maskData[i + 3] = 90;
                }
            }

            const mask = document.createElement("canvas");
            mask.width = w;
            mask.height = h;
            mask.getContext("2d").putImageData(new ImageData(maskData, w, h), 0, 0);

            this.maskCanvas = mask;
        }
    }

    _renderImage(imageInput) {
        const w = imageInput.width;
        const h = imageInput.height;

        if (!w || !h) return;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        const d = imageInput.data;

        if (d instanceof ImageData) {
            ctx.putImageData(d, 0, 0);
        } else if (
            (d instanceof Uint8ClampedArray || d instanceof Uint8Array) &&
            d.length === w * h * 4
        ) {
            ctx.putImageData(new ImageData(d, w, h), 0, 0);
        } else {
            const colorMap = (typeof getColormap === "function")
                ? getColormap(imageInput.colormap)
                : (v => ({ r: v, g: v, b: v }));

            const min = Number.isFinite(imageInput.minValue)
                ? imageInput.minValue
                : 0;

            const max = Number.isFinite(imageInput.maxValue)
                ? imageInput.maxValue
                : 1;

            const range = Math.abs(max - min) + 1e-9;

            const out = new Uint8ClampedArray(w * h * 4);
            let idx = 0;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let value = 0;

                    if (Array.isArray(d)) {
                        if (Array.isArray(d[y]) || ArrayBuffer.isView(d[y])) {
                            value = d[y][x] ?? 0;
                        } else {
                            value = d[y * w + x] ?? 0;
                        }
                    } else if (ArrayBuffer.isView(d) && d.length === w * h) {
                        value = d[y * w + x] ?? 0;
                    }

                    let normalizedValue = (value - min) / range;
                    if (!Number.isFinite(normalizedValue)) normalizedValue = 0;
                    normalizedValue = Math.max(0, Math.min(1, normalizedValue));

                    const c = colorMap(normalizedValue);

                    const r = Array.isArray(c) ? c[0] : (c?.r ?? 0);
                    const g = Array.isArray(c) ? c[1] : (c?.g ?? 0);
                    const b = Array.isArray(c) ? c[2] : (c?.b ?? 0);

                    out[idx++] = r * 255;
                    out[idx++] = g * 255;
                    out[idx++] = b * 255;
                    out[idx++] = 255;
                }
            }

            ctx.putImageData(new ImageData(out, w, h), 0, 0);
        }

        this.previewCanvas = canvas;
        this.img = ctx.getImageData(0, 0, w, h);
    }

    onExecute() {
        const imageInput = this.getInputData(0);
        const lassoInput = this.getInputData(1);

        this.inputLassoData = lassoInput;

        // Прокидываем исходные данные без изменений.
        this.setOutputData(0, imageInput || null);
        this.setOutputData(1, this._hasInputLasso() ? (lassoInput ?? null) : null);

        const w = imageInput?.width || 0;
        const h = imageInput?.height || 0;

        this.properties.width = w;
        this.properties.height = h;

        this.previewCanvas = null;
        this.img = null;
        this.maskCanvas = null;
        this.contour = [];
        this.points = [];
        this.bbox = { x: 0, y: 0, w: 0, h: 0 };

        if (imageInput && w && h) {
            this._renderImage(imageInput);
        }

        this._prepareLasso(lassoInput, w, h);

        this.bbox = this._bbox(this.contour.length ? this.contour : this.points);

        if (this.previewCanvas) {
            this.size[0] = w + this.beginx * 2;
            this.size[1] = h + this.beginy + this.beginx + this.infoHeight;
        } else {
            this.size[0] = 180;
            this.size[1] = 160;
        }
    }

    onDrawBackground(ctx) {
        if (!this.previewCanvas) return;

        const w = this.previewCanvas.width;
        const h = this.previewCanvas.height;

        this.size[0] = w + this.beginx * 2;
        this.size[1] = h + this.beginy + this.beginx + this.infoHeight;

        ctx.drawImage(this.previewCanvas, this.beginx, this.beginy, w, h);

        if (this.maskCanvas) {
            ctx.drawImage(this.maskCanvas, this.beginx, this.beginy, w, h);
        }

        if (this.contour.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(
                this.beginx + this.contour[0][0],
                this.beginy + this.contour[0][1]
            );

            for (let i = 1; i < this.contour.length; i++) {
                ctx.lineTo(
                    this.beginx + this.contour[i][0],
                    this.beginy + this.contour[i][1]
                );
            }

            ctx.closePath();

            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
            ctx.fill();
        }
    }

    onDrawForeground(ctx) {
        if (!this.previewCanvas) return;

        const bbox = this.bbox;
        const hasSelection = this.contour.length > 0 || this.points.length > 0;

        const text = hasSelection
            ? `contour: ${this.contour.length}  points: ${this.points.length}  x: ${bbox.x}  y: ${bbox.y}  w: ${bbox.w}  h: ${bbox.h}`
            : "no selection";

        ctx.save();

        ctx.font = "12px monospace";
        ctx.fillStyle = "#e5e7eb";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        const x = this.beginx;
        const y = this.beginy + this.previewCanvas.height + 6;

        ctx.fillText(text, x, y);

        ctx.restore();
    }
}

LiteGraph.registerNodeType("roi/lasso_viewer", ROILassoViewerNode);