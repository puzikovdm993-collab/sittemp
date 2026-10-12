
class ROIMaskStoreNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Хранить Mask";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg"
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);


        this.addInput("Points", Types.POINTS);
        this.addOutput("Points", Types.POINTS);

        // this.addInput("Image", Types.IMAGE);
        // this.addOutput("Mask", "MASK");
        // this.addOutput("selectRectangle", Types.SELECTRECTANGLE);


        this.properties = this.properties || {};

        // Сериализуемые поля:
        this.properties.maskBase64 = null;   // base64-строка маски
        this.properties.maskWidth = 0;
        this.properties.maskHeight = 0;

        this.properties.storedPoints = null;
        this.properties.storedBbox = null;

        this.size = [180, 60];
    }

    // Есть ли сохранённые данные (переживают сериализацию)
    _hasData() {
        // console.log(this.properties.maskBase64)
        // console.log(this.properties.storedPoints)
        return !!(
            this.properties.storedPoints?.length ||
            this.properties.maskBase64
        );
    }
    // Uint8Array → base64
    _uint8ToBase64(u8) {
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < u8.length; i += chunk) {
            binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    // base64 → Uint8Array
    _base64ToUint8(b64) {
        const binary = atob(b64);
        const u8 = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            u8[i] = binary.charCodeAt(i);
        }
        return u8;
    }
    // Строит маску из insidePoints
    _buildMask(points, w, h) {
        const mask = new Uint8Array(w * h);
        for (const [x, y] of points) {
            if (x >= 0 && x < w && y >= 0 && y < h) {
                mask[y * w + x] = 1;
            }
        }
        return mask;
    }

    _resultToBase64Binary(result) {
        const buf = new ArrayBuffer(result.length * 8);
        const view = new DataView(buf);
    
        for (let i = 0; i < result.length; i++) {
            view.setInt32(i * 8, result[i][0], true);
            view.setInt32(i * 8 + 4, result[i][1], true);
        }
    
        return this._uint8ToBase64(new Uint8Array(buf));
    }
    _base64BinaryToResult(base64) {
        const binary = atob(base64);
        const u8 = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    
        const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        const count = u8.byteLength / 8;
        const result = new Array(count);
    
        for (let i = 0; i < count; i++) {
            result[i] = [
                view.getInt32(i * 8, true),
                view.getInt32(i * 8 + 4, true)
            ];
        }
    
        return result;
    }
    
    
// ─── Индикатор ───────────────────────────────────────────────
    onDrawForeground(ctx) {
        const hasData = this._hasData();

        ctx.save();

        // Цветная точка в правом верхнем углу
        const dotX = this.size[0] - 14;
        const dotY = 14;
        const dotR = 5;

        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = hasData ? "#22c55e" : "#ef4444";
        ctx.fill();

        // Текст
        ctx.font = "11px monospace";
        ctx.fillStyle = hasData ? "#22c55e" : "#ef4444";
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        ctx.fillText(
            hasData ? "есть данные" : "нет данных",
            dotX - 10,
            dotY
        );

        // Размер маски (если есть)
        if (hasData && this.properties.maskWidth) {
            ctx.fillStyle = "#9ca3af";
            ctx.textAlign = "left";
            ctx.fillText(
                `${this.properties.maskWidth}×${this.properties.maskHeight}`,
                10,
                this.size[1] - 12
            );
        }

        ctx.restore();
    }
    // ─────────────────────────────────────────────────────────────

    onExecute() {

        let points = this.getInputData(0);





        // Если вход нет — берём из properties (восстановлено при загрузке графа)
        if (!points && this.properties.storedPoints) {
            points = this.properties.storedPoints;
        }



        let mask = null;

        if (points.points && points.points.length > 0) {

            // Сохраняем в properties → сериализуется с графом
            this.properties.maskBase64 = this._resultToBase64Binary(points.points);
            this.properties.storedPoints = points;
            mask = points.points;

        } else if (this.properties.maskBase64) {

            // Восстанавливаем из properties (после загрузки графа)
            mask = this._base64BinaryToResult(this.properties.maskBase64);

        }

        // Выход Mask
        if (mask ) {
            this.setOutputData(0, {
                points: mask,
                contour: points.contour
            });
        } else {
            this.setOutputData(0, 893434);
        }

        
    }
}

LiteGraph.registerNodeType("roi/mask_store", ROIMaskStoreNode);

