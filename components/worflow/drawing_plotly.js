
const PLOTLY_DATA = "PLOTLY_DATA";
class PlotlyNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Plotly";

        this.addInput("Trass", Types.TRASS);
        // this.addOutput("Data", PLOTLY_DATA);

        this.beginx = 20;
        this.beginy = 55;
        this.infoHeight = 18;

        this.properties = {
            width: 360,
            height: 240,
            layout: {
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                margin: { l: 40, r: 20, t: 30, b: 30 },
                font: { color: "#e5e7eb" }
            },
            config: {
                displayModeBar: false,
                responsive: false,
                staticPlot: true
            }
        };

        this.plotImage = null;
        this.placeholderText = null;

        this._container = null;
        this._plotEl = null;
        this._renderTimer = null;
        this._renderToken = 0;
        this._pendingData = null;
    }

    _renderPlot(data) {
        this._pendingData = data;

        if (this._renderTimer) return;

        this._renderTimer = setTimeout(() => {
            this._renderTimer = null;
            this._doRender(this._pendingData);
        }, 50);
    }

    async _doRender(data) {
        const w = Math.max(100, Number(this.properties.width) || 360);
        const h = Math.max(100, Number(this.properties.height) || 240);

        if (typeof window === "undefined" || !window.Plotly) {
            this._drawPlaceholder("Plotly не загружен");
            return;
        }

        const normalized = this._normalizeData(data);
        if (!normalized) {
            this._drawPlaceholder("Нет данных");
            return;
        }

        const el = this._ensureContainer(w, h);
        if (!el) {
            this._drawPlaceholder("DOM недоступен");
            return;
        }

        const token = ++this._renderToken;

        try {
            const layout = {
                ...normalized.layout,
                width: w,
                height: h,
                autosize: false
            };

            const config = {
                ...normalized.config,
                displayModeBar: false,
                responsive: false,
                staticPlot: true
            };
            await window.Plotly.react(el, normalized.traces, layout, config);

            const dataUrl = await window.Plotly.toImage(el, {
                format: "png",
                width: w,
                height: h,
                scale: 1
            });

            if (token !== this._renderToken) return;

            const img = new Image();
            img.onload = () => {
                if (token !== this._renderToken) return;

                this.plotImage = img;
                this.placeholderText = null;
                this.graph?.setDirtyCanvas("bg");
            };

            img.onerror = () => {
                if (token === this._renderToken) {
                    this._drawPlaceholder("Ошибка PNG");
                }
            };

            img.src = dataUrl;
        } catch (err) {
            console.error("PlotlyNode: render error", err);

            if (token === this._renderToken) {
                this._drawPlaceholder("Ошибка Plotly");
            }
        }
    }

    _normalizeData(data) {
        if (!data) return null;

        const baseLayout = this.properties.layout || {};
        const baseConfig = this.properties.config || {};

        const mergeLayout = (extra) =>
            extra ? { ...baseLayout, ...extra } : { ...baseLayout };

        const mergeConfig = (extra) =>
            extra ? { ...baseConfig, ...extra } : { ...baseConfig };

        // Формат 1: массив traces
        if (Array.isArray(data)) {
            return {
                traces: data,
                layout: mergeLayout(data.layout),
                config: mergeConfig(data.config)
            };
        }

        if (typeof data === "object") {
            // Формат 2: { traces: [...] }
            if (Array.isArray(data.traces)) {
                return {
                    traces: data.traces,
                    layout: mergeLayout(data.layout),
                    config: mergeConfig(data.config)
                };
            }

            // Формат 3: { data: [...] }
            if (Array.isArray(data.data)) {
                return {
                    traces: data.data,
                    layout: mergeLayout(data.layout),
                    config: mergeConfig(data.config)
                };
            }

            // Формат 4: { x: [...], y: [...] }
            if (data.x !== undefined || data.y !== undefined) {
                const trace = {
                    x: data.x,
                    y: data.y
                };

                if (data.type) trace.type = data.type;
                if (data.mode) trace.mode = data.mode;
                if (data.name) trace.name = data.name;

                return {
                    traces: [trace],
                    layout: mergeLayout(data.layout),
                    config: mergeConfig(data.config)
                };
            }
        }

        return null;
    }

    _ensureContainer(w, h) {
        if (typeof document === "undefined") return null;

        if (
            this._container &&
            this._plotEl &&
            document.body.contains(this._container)
        ) {
            this._plotEl.style.width = `${w}px`;
            this._plotEl.style.height = `${h}px`;
            return this._plotEl;
        }

        this._destroyContainer();

        const container = document.createElement("div");
        container.style.cssText =
            "position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;";

        const el = document.createElement("div");
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;

        container.appendChild(el);
        document.body.appendChild(container);

        this._container = container;
        this._plotEl = el;

        return el;
    }

    _destroyContainer() {
        if (this._renderTimer) {
            clearTimeout(this._renderTimer);
            this._renderTimer = null;
        }

        this._pendingData = null;

        if (
            this._plotEl &&
            typeof window !== "undefined" &&
            window.Plotly &&
            typeof window.Plotly.purge === "function"
        ) {
            try {
                const p = window.Plotly.purge(this._plotEl);
                if (p && typeof p.catch === "function") {
                    p.catch(() => {});
                }
            } catch (e) {
                // ignore
            }
        }

        if (this._container && this._container.parentNode) {
            this._container.remove();
        }

        this._container = null;
        this._plotEl = null;
    }

    _drawPlaceholder(text) {
        this.placeholderText = text || "Нет данных";
        this.plotImage = null;
        this.graph?.setDirtyCanvas("bg");
    }


    _generate123(data){
       
       const chartType = "line";
       const points = 50;
       const amplitude = 1.0;
       const frequency = 1.0;
       const noise = 0.0;
       const seriesCount = 1;
       const title = "Test";

        const width = data.width;
        const height = data.height;
        const datta = data.data;
        const dpi= data.dpi;

        

       const n = Math.max(2, Math.min(1000, Number(points) || 50));
       const amp = Number(amplitude) || 1;
       const freq = Number(frequency) || 1;
       const noiseAmp = Number(noise) || 0;
       const series = Math.max(1, Math.min(10, Number(seriesCount) || 1));

       const traces = [];

       for (let s = 0; s < series; s++) {
           const x = [];
           const y = [];

           for (let i = 0; i < height; i++) {
               x.push(datta[i][1]);
               y.push(datta[i][0]);
           }
           

           const trace = { x, y };

           switch (chartType) {
               case "bar":
                   trace.type = "bar";
                   trace.name = `bar ${s + 1}`;
                   break;

               case "scatter":
                   trace.type = "scatter";
                   trace.mode = "markers";
                   trace.marker = { size: 6 };
                   trace.name = `scatter ${s + 1}`;
                   break;

               case "area":
                   trace.type = "scatter";
                   trace.mode = "lines";
                   trace.fill = "tozeroy";
                   trace.line = { width: 1 };
                   trace.name = `area ${s + 1}`;
                   break;

               case "line":
               default:
                   trace.type = "scatter";
                   trace.mode = "lines";
                   trace.line = { width: 2 };
                   trace.name = `line ${s + 1}`;
                   break;
           }

           traces.push(trace);
       }

       const data123 = {
           traces,
           layout: {
               title: { text: title || "Test" },
               xaxis: { title: { text: "x" } },
               yaxis: { title: { text: "y" } }
           }
       };
    return data123;
   }


    onExecute() {
        const data = this.getInputData(0);


        
        this._renderPlot(this._generate123(data));
    }

    onPropertyChanged(name, value, old) {
        if (name === "width" || name === "height") {
            this._renderPlot(this.getInputData(0));
        }
    }

    onDrawBackground(ctx) {
        const w = Math.max(100, Number(this.properties.width) || 360);
        const h = Math.max(100, Number(this.properties.height) || 240);

        this.size[0] = w + this.beginx * 2;
        this.size[1] = h + this.beginy + this.beginx + this.infoHeight;

        ctx.save();

        ctx.fillStyle = "#0b1220";
        ctx.fillRect(this.beginx, this.beginy, w, h);

        if (this.plotImage) {
            ctx.drawImage(this.plotImage, this.beginx, this.beginy, w, h);
        } else {
            ctx.fillStyle = "#9ca3af";
            ctx.font = "14px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                this.placeholderText || "Нет данных",
                this.beginx + w / 2,
                this.beginy + h / 2
            );
        }

        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.strokeRect(this.beginx + 0.5, this.beginy + 0.5, w, h);

        ctx.restore();
    }

    onDrawForeground(ctx) {
        const w = Math.max(100, Number(this.properties.width) || 360);
        const h = Math.max(100, Number(this.properties.height) || 240);

        const data = this.getInputData(0);
        let text = "data: -";

        if (Array.isArray(data)) {
            text = `traces: ${data.length}`;
        } else if (data?.traces) {
            text = `traces: ${data.traces.length}`;
        } else if (Array.isArray(data?.data)) {
            text = `traces: ${data.data.length}`;
        } else if (data?.x !== undefined || data?.y !== undefined) {
            text = "trace: 1";
        }

        ctx.save();
        ctx.font = "12px monospace";
        ctx.fillStyle = "#e5e7eb";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(text, this.beginx, this.beginy + h + 6);
        ctx.restore();
    }

    onRemove() {
        this._destroyContainer();
    }
}

LiteGraph.registerNodeType("plot/plotly", PlotlyNode);






class PlotlyDataNode extends LGraphNode {
    constructor() {
        super();

        this.title = "Plotly Data";

        this.addOutput("Data", PLOTLY_DATA);

        this.properties = {
            chartType: "line",       // "line" | "bar" | "scatter" | "area"
            points: 50,
            amplitude: 1.0,
            frequency: 1.0,
            noise: 0.0,
            seriesCount: 1,
            title: "Test"
        };

        this.size = [220, 120];
        this.data = null;
    }

    _generate() {
        const {
            chartType,
            points,
            amplitude,
            frequency,
            noise,
            seriesCount,
            title
        } = this.properties;

        const n = Math.max(2, Math.min(1000, Number(points) || 50));
        const amp = Number(amplitude) || 1;
        const freq = Number(frequency) || 1;
        const noiseAmp = Number(noise) || 0;
        const series = Math.max(1, Math.min(10, Number(seriesCount) || 1));

        const traces = [];

        for (let s = 0; s < series; s++) {
            const x = [];
            const y = [];

            for (let i = 0; i < n; i++) {
                const t = i / (n - 1);
                x.push(Number((t * 10).toFixed(3)));

                let val = amp * Math.sin(2 * Math.PI * freq * t + s * 0.8);

                if (noiseAmp > 0) {
                    val += (Math.random() - 0.5) * 2 * noiseAmp;
                }

                y.push(Number(val.toFixed(4)));
            }

            const trace = { x, y };

            switch (chartType) {
                case "bar":
                    trace.type = "bar";
                    trace.name = `bar ${s + 1}`;
                    break;

                case "scatter":
                    trace.type = "scatter";
                    trace.mode = "markers";
                    trace.marker = { size: 6 };
                    trace.name = `scatter ${s + 1}`;
                    break;

                case "area":
                    trace.type = "scatter";
                    trace.mode = "lines";
                    trace.fill = "tozeroy";
                    trace.line = { width: 1 };
                    trace.name = `area ${s + 1}`;
                    break;

                case "line":
                default:
                    trace.type = "scatter";
                    trace.mode = "lines";
                    trace.line = { width: 2 };
                    trace.name = `line ${s + 1}`;
                    break;
            }

            traces.push(trace);
        }

        this.data = {
            traces,
            layout: {
                title: { text: title || "Test" },
                xaxis: { title: { text: "x" } },
                yaxis: { title: { text: "y" } }
            }
        };

        this.graph?.setDirtyCanvas(true, true);
    }

    onPropertyChanged(name, value, old) {
        this._generate();
    }

    onDrawBackground(ctx) {
        const w = this.size[0];
        const h = this.size[1];

        ctx.save();

        // Фон
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, w, h);

        // Заголовок
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(this.title, 10, 8);

        // Свойства
        const lines = [
            `type:    ${this.properties.chartType}`,
            `points:  ${this.properties.points}`,
            `amp:     ${this.properties.amplitude}`,
            `freq:    ${this.properties.frequency}`,
            `noise:   ${this.properties.noise}`,
            `series:  ${this.properties.seriesCount}`
        ];

        ctx.font = "11px monospace";
        ctx.fillStyle = "#9ca3af";

        lines.forEach((line, i) => {
            ctx.fillText(line, 10, 30 + i * 16);
        });

        // Кнопка "Generate"
        const btnX = 10;
        const btnY = h - 32;
        const btnW = 90;
        const btnH = 22;

        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Generate", btnX + btnW / 2, btnY + btnH / 2);

        // Кнопка "Random"
        const rndX = 110;
        ctx.fillStyle = "#065f46";
        ctx.fillRect(rndX, btnY, 90, btnH);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Random", rndX + 45, btnY + btnH / 2);

        ctx.restore();
    }

    onMouseDown(event, pos) {
        const btnY = this.size[1] - 32;
        const btnH = 22;

        if (pos[1] < btnY || pos[1] > btnY + btnH) return false;

        // Generate
        if (pos[0] >= 10 && pos[0] <= 100) {
            this._generate();
            return true;
        }

        // Random
        if (pos[0] >= 110 && pos[0] <= 200) {
            this.properties.amplitude = Number((Math.random() * 2 + 0.5).toFixed(2));
            this.properties.frequency = Number((Math.random() * 3 + 0.5).toFixed(2));
            this.properties.noise = Number((Math.random() * 0.5).toFixed(2));
            this.properties.points = Math.floor(Math.random() * 100) + 10;
            this._generate();
            return true;
        }

        return false;
    }

    onExecute() {
        if (!this.data) {
            this._generate();
        }
        this.setOutputData(0, this.data);
    }

    onSerialize(obj) {
        obj.data = this.data;
        return obj;
    }

    onDeserialize(obj) {
        this.data = obj.data || null;
    }
}
LiteGraph.registerNodeType("plot/data", PlotlyDataNode);




