function showNodePreview(node) {
    const previewData = node.properties.previewData;
    if (!previewData || !previewData.width) {
        alert("Нет данных для превью");
        return;
    }

    const W = previewData.width;
    const H = previewData.height;

    // --- Модалка ---
    let modal = document.getElementById("imageModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "imageModal";
        modal.style.cssText = `
            display:none; position:fixed; top:0; left:0;
            width:100%; height:100%;
            background:rgba(0,0,0,0.9); z-index:10000;
            justify-content:center; align-items:center;
        `;
        modal.innerHTML = `
        <div style="position:relative; width:95vw; height:92vh;
                    background:#1a1a2e; border-radius:12px;
                    display:flex; flex-direction:column; overflow:hidden;">
            <!-- Шапка -->
            <div style="display:flex; align-items:center; gap:10px;
                        padding:10px 16px; background:#16213e;">
                <span style="color:#ccc; font-size:14px; font-weight:600;">
                    Превью + График
                </span>
    
                <div style="display:flex; margin-left:20px;
                            border:1px solid #444; border-radius:6px; overflow:hidden;">
                    <button id="typeLineBtn" class="typeBtn" data-type="line" style="
                        background:#2a5a8a; border:none; color:#fff;
                        padding:5px 14px; cursor:pointer; font-size:12px;">
                        Прямая
                    </button>
                    <button id="typePolyBtn" class="typeBtn" data-type="polyline" style="
                        background:#222; border:none; color:#aaa;
                        padding:5px 14px; cursor:pointer; font-size:12px;">
                        Ломанная
                    </button>
                </div>
    
                <button id="clearLineBtn" style="
                    background:#2a5a8a; border:none; color:#fff;
                    padding:5px 14px; cursor:pointer; border-radius:5px;
                    font-size:12px; margin-left:auto;">
                    Очистить
                </button>
                <button id="closeModalBtn" style="
                    background:#333; border:none; color:#fff;
                    font-size:20px; cursor:pointer; border-radius:50%;
                    width:32px; height:32px;">
                    &times;
                </button>
            </div>
            <!-- Тело -->
            <div style="flex:1; display:flex; gap:0; overflow:hidden;">
                <!-- Левая: canvas -->
                <div style="flex:1; position:relative; display:flex;
                            align-items:center; justify-content:center;
                            background:#0d1117; overflow:hidden;">
                    <canvas id="previewCanvas" style="
                        max-width:100%; max-height:100%;
                        cursor:crosshair; image-rendering:pixelated;
                        display:block;
                    "></canvas>
                    <div id="drawHint" style="position:absolute; bottom:10px; left:50%;
                        transform:translateX(-50%); color:#888; font-size:12px;
                        background:rgba(0,0,0,0.6); padding:4px 12px;
                        border-radius:4px; pointer-events:none;">
                        Рисуйте линию мышкой
                    </div>
                </div>
                <!-- Правая: Plotly с отступами -->
                <div style="flex:1; border-left:1px solid #333;
                            display:flex; align-items:center; justify-content:center;
                            background:#0d1117; padding:24px;">
                    <div id="plotDiv" style="
                        width:100%;
                        height:100%;
                        max-width:600px;
                        max-height:500px;
                        background:#16213e;
                        border-radius:8px;
                        box-shadow:0 2px 12px rgba(0,0,0,0.4);
                    "></div>
                </div>
            </div>
        </div>
    `;
    
        document.body.appendChild(modal);

        modal.querySelector("#closeModalBtn").addEventListener("click", () => {
            modal.style.display = "none";
            Plotly.purge("plotDiv");
        });
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
                Plotly.purge("plotDiv");
            }
        });
    }

    // --- Canvas ---
    const canvas = modal.querySelector("#previewCanvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(previewData, 0, 0);

    // --- Состояние ---
    let lineType = "line";       // "line" | "polyline"
    let drawing = false;
    let linePoints = [];         // для ломанной: [[x,y], ...]
    let startPt = null;          // для прямой: [x,y]
    let endPt = null;            // для прямой: [x,y]
    let previewPt = null;        // текущая позиция мыши (для предпросмотра прямой)

    // --- Переключатель типа ---
    const typeLineBtn = modal.querySelector("#typeLineBtn");
    const typePolyBtn = modal.querySelector("#typePolyBtn");

    function setType(type) {
        lineType = type;
        typeLineBtn.style.background = type === "line" ? "#2a5a8a" : "#222";
        typeLineBtn.style.color = type === "line" ? "#fff" : "#aaa";
        typePolyBtn.style.background = type === "polyline" ? "#2a5a8a" : "#222";
        typePolyBtn.style.color = type === "polyline" ? "#fff" : "#aaa";
        clearLine();
    }

    typeLineBtn.addEventListener("click", () => setType("line"));
    typePolyBtn.addEventListener("click", () => setType("polyline"));

    // --- Координаты мыши → canvas ---
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return [
            Math.max(0, Math.min(W - 1, Math.round((e.clientX - rect.left) * scaleX))),
            Math.max(0, Math.min(H - 1, Math.round((e.clientY - rect.top) * scaleY)))
        ];
    }

    // --- Очистка ---
    function clearLine() {
        linePoints = [];
        startPt = null;
        endPt = null;
        previewPt = null;
        drawing = false;
        redrawWithLine();
        Plotly.purge("plotDiv");
        showEmptyPlot();
    }

    modal.querySelector("#clearLineBtn").addEventListener("click", clearLine);

    // --- Рисование ---
    canvas.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const [x, y] = getCanvasCoords(e);

        if (lineType === "line") {
            drawing = true;
            startPt = [x, y];
            endPt = null;
            previewPt = [x, y];
        } else {
            drawing = true;
            linePoints = [[x, y]];
        }
        redrawWithLine();
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!drawing) return;
        const [x, y] = getCanvasCoords(e);

        if (lineType === "line") {
            previewPt = [x, y];
        } else {
            linePoints.push([x, y]);
        }
        redrawWithLine();
    });

    canvas.addEventListener("mouseup", (e) => {
        if (!drawing) return;
        drawing = false;
        const [x, y] = getCanvasCoords(e);

        if (lineType === "line") {
            endPt = [x, y];
            previewPt = null;
            // Интерполируем 100 точек для графика
            const pts = interpolateLine(startPt, endPt, 100);
            updatePlot(node, pts, W, H);
        } else {
            if (linePoints.length < 2) {
                linePoints = [];
                redrawWithLine();
                return;
            }
            updatePlot(node, linePoints, W, H);
        }
        redrawWithLine();
    });

    canvas.addEventListener("mouseleave", () => {
        if (!drawing) return;
        drawing = false;
        if (lineType === "line") {
            // Если отпустили вне canvas — отменяем
            startPt = null;
            previewPt = null;
        }
        redrawWithLine();
    });

    // --- Перерисовка ---
    function redrawWithLine() {
        ctx.putImageData(previewData, 0, 0);

        ctx.save();
        ctx.strokeStyle = "#ff3333";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#ff3333";
        ctx.shadowBlur = 3;

        if (lineType === "line") {
            const from = startPt;
            const to = previewPt || endPt;
            if (from && to) {
                // Предпросмотр — пунктир, финал — сплошная
                if (previewPt && !endPt) {
                    ctx.setLineDash([6, 4]);
                    ctx.globalAlpha = 0.7;
                }
                ctx.beginPath();
                ctx.moveTo(from[0], from[1]);
                ctx.lineTo(to[0], to[1]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;

                // Маркеры концов
                ctx.fillStyle = "#ff6666";
                ctx.beginPath();
                ctx.arc(from[0], from[1], 4, 0, Math.PI * 2);
                ctx.fill();
                if (endPt) {
                    ctx.beginPath();
                    ctx.arc(endPt[0], endPt[1], 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else {
            if (linePoints.length >= 2) {
                ctx.beginPath();
                for (let i = 0; i < linePoints.length; i++) {
                    const [x, y] = linePoints[i];
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Маркеры каждые 20 точек
                ctx.fillStyle = "#ff6666";
                for (let i = 0; i < linePoints.length; i += 20) {
                    const [x, y] = linePoints[i];
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    // --- Запуск ---
    modal.style.display = "flex";
    showEmptyPlot();
}

function interpolateLine(p1, p2, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        pts.push([
            Math.round(p1[0] + (p2[0] - p1[0]) * t),
            Math.round(p1[1] + (p2[1] - p1[1]) * t)
        ]);
    }
    return pts;
}

function showEmptyPlot() {
    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor:  "rgba(0,0,0,0)",
        font: { color: "#888", size: 12 },
        xaxis: { title: "Точка на линии", gridcolor: "#333" },
        yaxis: { title: "Значение", gridcolor: "#333" },
        margin: { l: 55, r: 20, t: 30, b: 45 },
        showlegend: false
    };
    Plotly.newPlot("plotDiv", [], layout, { responsive: true, displayModeBar: false });
}

function updatePlot(node, points, W, H) {
    const data = node.properties.data;
    if (!data || points.length < 2) return;

    const width  = node.properties.width  || W;
    const height = node.properties.height || H;

    const values = [];
    for (const [px, py] of points) {
        const x = Math.max(0, Math.min(width - 1, px));
        const y = Math.max(0, Math.min(height - 1, py));

        let val;
        if (Array.isArray(data[0])) {
            val = data[y][x];
        } else {
            val = data[y * width + x];
        }
        values.push(val);
    }

    const trace = {
        x: values.map((_, i) => i),
        y: values,
        mode: "lines+markers",
        name: "Значения",
        line: { color: "#4a9eff", width: 2 },
        marker: { size: 3, color: "#4a9eff" }
    };

    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor:  "rgba(0,0,0,0)",
        font: { color: "#ccc", size: 12 },
        xaxis: { title: "Точка на линии", gridcolor: "#333" },
        yaxis: { title: "Значение", gridcolor: "#333" },
        margin: { l: 55, r: 20, t: 30, b: 45 },
        showlegend: false
    };

    Plotly.react("plotDiv", [trace], layout, { responsive: true, displayModeBar: false });
}

function closePlotModal() {
    const modal = document.getElementById("plotModal");
    if (modal) {
        modal.style.display = "none";
        Plotly.purge("plotDiv");
    }
}

// Escape закрывает
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePlotModal();
});
