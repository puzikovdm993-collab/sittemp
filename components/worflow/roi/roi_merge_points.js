const ROI_MERGE_INPUT_COUNT = 2;

class ROIMergePointsNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Объединить Points";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg"
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);


        this.properties = this.properties || {};

        // true  — union, без дублей
        // false — просто склеить все массивы
        this.properties.deduplicate = true;

        for (let i = 0; i < ROI_MERGE_INPUT_COUNT; i++) {
            this.addInput(`Points ${i + 1}`, Types.POINTS);
        }

        this.addOutput("Points", Types.POINTS);

        this.size = [220, 90];

        this._lastTotal = 0;
        this._lastMerged = 0;
        this._lastCounts = [];
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
                const x = Number(p[0]);
                const y = Number(p[1]);

                return Number.isFinite(x) && Number.isFinite(y)
                    ? [x, y]
                    : null;
            }

            if (p && typeof p === "object") {
                const x = Number(p.x);
                const y = Number(p.y);

                return Number.isFinite(x) && Number.isFinite(y)
                    ? [x, y]
                    : null;
            }

            return null;
        };

        // Плоский массив: [x1, y1, x2, y2, ...]
        if (
            arr.length >= 2 &&
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

    // Извлекает список точек из входных данных.
    // Поддерживает:
    // 1) [[x, y], ...]
    // 2) [{x, y}, ...]
    // 3) [x1, y1, x2, y2, ...]
    // 4) { points: [[x, y], ...] }
    // 5) { x: [...], y: [...] }
    // 6) { contour: [[x, y], ...] }
    _normalizePoints(data) {
        if (!data) return [];

        if (Array.isArray(data)) {
            return this._normalizePointArray(data) || [];
        }

        if (ArrayBuffer.isView(data)) {
            return this._normalizePointArray(Array.from(data)) || [];
        }

        if (typeof data === "object") {
            // Приоритет: points
            if (data.points) {
                const raw = Array.isArray(data.points)
                    ? data.points
                    : (ArrayBuffer.isView(data.points)
                        ? Array.from(data.points)
                        : null);

                if (raw) {
                    const pts = this._normalizePointArray(raw);

                    if (pts && pts.length) {
                        return pts;
                    }
                }
            }

            // Поддержка { x: [...], y: [...] }
            if (data.x && data.y) {
                const x = Array.isArray(data.x)
                    ? data.x
                    : (ArrayBuffer.isView(data.x)
                        ? Array.from(data.x)
                        : null);

                const y = Array.isArray(data.y)
                    ? data.y
                    : (ArrayBuffer.isView(data.y)
                        ? Array.from(data.y)
                        : null);

                if (x && y && x.length && y.length) {
                    const len = Math.min(x.length, y.length);
                    const pts = [];

                    for (let i = 0; i < len; i++) {
                        const px = Number(x[i]);
                        const py = Number(y[i]);

                        if (Number.isFinite(px) && Number.isFinite(py)) {
                            pts.push([px, py]);
                        }
                    }

                    if (pts.length) {
                        return pts;
                    }
                }
            }

            // Если points нет, можно использовать contour как список точек.
            if (data.contour) {
                const raw = Array.isArray(data.contour)
                    ? data.contour
                    : (ArrayBuffer.isView(data.contour)
                        ? Array.from(data.contour)
                        : null);

                if (raw) {
                    return this._normalizePointArray(raw) || [];
                }
            }
        }

        return [];
    }

    // Извлекает только контур, если он явно передан.
    _normalizeContour(data) {
        if (!data || typeof data !== "object") return [];

        if (data.contour) {
            const raw = Array.isArray(data.contour)
                ? data.contour
                : (ArrayBuffer.isView(data.contour)
                    ? Array.from(data.contour)
                    : null);

            if (raw) {
                return this._normalizePointArray(raw) || [];
            }
        }

        return [];
    }

    onExecute() {
        const merged = [];
        const seen = new Set();
        const contours = [];

        let total = 0;
        const counts = [];

        const dedup = this.properties?.deduplicate !== false;
        const inputCount = this.inputs?.length || 0;

        for (let i = 0; i < inputCount; i++) {
            const data = this.getInputData(i);
            const points = this._normalizePoints(data);

            total += points.length;
            counts.push(points.length);

            if (points.length) {
                if (dedup) {
                    for (const p of points) {
                        const key = `${p[0]},${p[1]}`;

                        if (!seen.has(key)) {
                            seen.add(key);
                            merged.push(p);
                        }
                    }
                } else {
                    for (const p of points) {
                        merged.push(p);
                    }
                }
            }

            const contour = this._normalizeContour(data);

            if (contour.length) {
                contours.push(contour);
            }
        }

        this._lastTotal = total;
        this._lastMerged = merged.length;
        this._lastCounts = counts;

        if (!merged.length) {
            this.setOutputData(0, null);
            return;
        }

        // Формат совместим с вашим ROILassoNode:
        // {
        //   points: [[x, y], ...],
        //   contour: [[x, y], ...]
        // }
        //
        // Дополнительно передаем contours — массив всех входных контуров.
        this.setOutputData(0, {
            points: merged,
            contour: contours[0] || [],
            contours
        });
    }

    onDrawForeground(ctx) {
        ctx.save();

        ctx.font = "12px monospace";
        ctx.fillStyle = "#e5e7eb";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        const x = 10;
        let y = 20;

        ctx.fillText(`total: ${this._lastTotal || 0}`, x, y);
        y += 14;

        ctx.fillText(`merged: ${this._lastMerged || 0}`, x, y);
        y += 14;

        const counts = (this._lastCounts || [])
            .map((c, i) => `${i + 1}:${c}`)
            .join(" ");

        ctx.fillText(counts, x, y);

        ctx.restore();
    }
}

LiteGraph.registerNodeType("roi/merge_points", ROIMergePointsNode);
