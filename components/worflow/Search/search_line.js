






/*
 * Пример использования:
 *
 * const width = 10;
 * const height = 10;
 *
 * const pixelValues = new Array(width * height).fill(0);
 *
 * // Пример подходящих точек:
 * pixelValues[1 * width + 2] = 0.5;
 * pixelValues[2 * width + 4] = 0.5;
 * pixelValues[3 * width + 6] = 0.5;
 *
 * const points = findSuitablePoints(pixelValues, width, height);
 * logLineInfo(points);
 */


class LineSearch extends FilterNode {
    constructor() {
        super();
        this.title = "Поиск прямой";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" 
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);

        // this.addOutput("CurcleCenter", Types.NUMBER1);
        this.addOutput("Угол", Types.ROTATE);

        this.size = [250, 100];
        this.resizable = false;
        // this.circleResult = null;
        this.lineResult = null;
    }

    onExecute() {

        if (!(this.inputs[0] && this.inputs[0].link)) {
            console.error("Ошибка: вход должен быть подключён для работы узла.");
            alert("Ошибка: вход должен быть подключён для работы узла.");
            return;
        }

        const inputData = this.getInputData(0);
        
        if (!inputData)  {
            console.error("Входные данные матрицы отсутствуют");
            return;
        }

        // Валидация входных данных
        if (!Array.isArray(inputData.data) ) {
            console.error("Ошибка: входные данные не являются матрицей.");
            return;
        }
        // Валидация входных данных
        if (inputData.data.length === 0) {
            console.error("Некорректные входные данные: матрица пустая.");
            return;
        }
        if (!Number.isFinite(inputData.minValue) || !Number.isFinite(inputData.maxValue)) {
            console.error("Некорректные minValue/maxValue во входных данных.");
            return;
        }
        if (!Number.isFinite(inputData.height) || !Number.isFinite(inputData.width) || inputData.height <= 0 || inputData.width <= 0) {
            console.error("Ошибка: некорректные размеры матрицы.");
            return;
        }


        const result = this._circle_line(inputData.data, inputData.width, inputData.height);
        this.lineResult = result;
        this.properties.lineResult = result;

        console.log(result)
        // Формируем выходные данные
        const outputData = {
            dpi:        inputData.dpi,
            width:      inputData.width,
            height:     inputData.height,
            data:       inputData.data,
            minValue:   inputData.minValue,
            maxValue:   inputData.maxValue,
            autoscale:  inputData.autoscale,
            colormap:   inputData.colormap,
            filename:   inputData.filename,
            format:     inputData.format
        };
        this.setOutputData(0, outputData);


        this.setOutputData(1, 
            {
                angle: result.angle
            }
        );
        



        // // Создаем временный canvas для исходного ImageData
        // const tempCanvas = document.createElement('canvas');
        // const tempCtx = tempCanvas.getContext('2d');

        // tempCanvas.width = this.properties.width;
        // tempCanvas.height = this.properties.height;

        // const minVal =  this.properties.minValue;
        // const maxVal =  this.properties.maxValue;

        // const autoscale = this.properties.autoscale;
        // const colormap = this.properties.colormap;
        // const colorMap = getColormap(colormap);
        // const data = new Uint8ClampedArray(width * height * 4);
        // let dataIndex = 0;
        // for (let y = 0; y < height; y++) {
        //     for (let x = 0; x < width; x++) {
        //         const normalizedValue = autoscale 
        //             ? (this.properties.data[y][x] - minVal) / (maxVal - minVal + 1e-9) 
        //             : (this.properties.data[y][x] - scale[0]) / (scale[1] - scale[0] + 1e-9);
                
        //         const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
        //         data[dataIndex++] = color.r * 255;
        //         data[dataIndex++] = color.g * 255;
        //         data[dataIndex++] = color.b * 255;
        //         data[dataIndex++] = 255;
        //     }
        // }
        // const imageData = new ImageData(data, width, height);
        // tempCtx.putImageData(imageData, 0, 0); // Полное копирование ImageData

        // // Создаем canvas для обрезанного фрагмента
        // const cropped = document.createElement('canvas');
        // const ctx = cropped.getContext('2d');
        // cropped.width = width;
        // cropped.height = height;

        // ctx.drawImage( tempCanvas, 0, 0, width, height, 0, 0, width, height);
        // const out = ctx.getImageData(0, 0, width, height);
        // this.properties.previewData = out;
    }

    onDrawForeground(ctx) {
        if (this.flags && this.flags.collapsed) {
            return;
        }
    
        if (typeof super.onDrawForeground === "function") {
            super.onDrawForeground(ctx);
        }
    
        ctx.save();
    
        ctx.font = "12px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#e6e6e6";
    
        const pad = 10;
        const y = this.size[1] - 36;
    
        const res = (this.properties && this.properties.lineResult) || this.lineResult;
    
        if (
            !res ||
            !Number.isFinite(res.distance) ||
            !Number.isFinite(res.angle) ||
            res.distance < 0||
            res.angle < 0
        ) {
            ctx.fillText("Результат: нет", pad, y);
        } else {
            ctx.fillText(`Дистанция: (${res.distance.toFixed(2)})`, pad, y);
            ctx.fillText(`Угол: ${res.angle.toFixed(2)}`, pad, y + 16);
        }
    
        ctx.restore();
    }
    
    _circle_line(data,width, height) {
        // Находим подходящие точки
        const points = this._findSuitablePoints(data,width,height);
        if (points.length === 0) {
            console.error("Ошибка: Подходящие точки не найдены.");
            alert("Ошибка: Подходящие точки не найдены.");
            return;
        }

        const line = this._fitLine(points);

        if (!line) {
            console.error("Ошибка: Недостаточно точек для построения прямой.");
            alert("Ошибка: Недостаточно точек для построения прямой.");
            return;
        }


        return { 
            distance: line.distance, 
            angle: 90 - line.angle
        };
    }

    /**
     * Находит подходящие точки по массиву значений пикселей.
     *
     * @param {number[]} pixelValues - плоский массив значений пикселей.
     * @param {number} width - ширина изображения.
     * @param {number} height - высота изображения.
     * @param {number} [low=LOW_THRESHOLD]
     * @param {number} [high=HIGH_THRESHOLD]
     * @returns {{x: number, y: number}[]}
     */
    _findSuitablePoints(matrix, width, height) {
        const LOW_THRESHOLD = 0.09;
        const HIGH_THRESHOLD = 1.01;


        const points = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const value = matrix[y][x];
                if (value > LOW_THRESHOLD && value < HIGH_THRESHOLD) {
                    points.push({ x, y });
                }
            }
        }
        return points;
    }

    /**
     * Строит прямую по точкам.
     *
     * Использует уравнение прямой:
     * A * x + B * y + C = 0
     *
     * @param {{x: number, y: number}[]} points
     * @returns {{A: number, B: number, C: number, distance: number, angle: number} | null}
     */
    _fitLine(points) {
        const EPS = 1e-12;
        const n = points.length;

        if (n < 2) {
            return null;
        }

        let cx = 0;
        let cy = 0;

        for (let i = 0; i < n; i++) {
            cx += points[i].x;
            cy += points[i].y;
        }

        cx /= n;
        cy /= n;

        let sxx = 0;
        let syy = 0;
        let sxy = 0;

        for (let i = 0; i < n; i++) {
            const dx = points[i].x - cx;
            const dy = points[i].y - cy;

            sxx += dx * dx;
            syy += dy * dy;
            sxy += dx * dy;
        }

        let A;
        let B;
        let C;

        // Если прямая ближе к горизонтальной: y = m * x + b
        if (sxx > EPS && sxx >= syy) {
            const m = sxy / sxx;
            const b = cy - m * cx;

            // -m * x + y - b = 0
            A = -m;
            B = 1;
            C = -b;
        }
        // Если прямая ближе к вертикальной: x = m * y + b
        else if (syy > EPS) {
            const m = sxy / syy;
            const b = cx - m * cy;

            // x - m * y - b = 0
            A = 1;
            B = -m;
            C = -b;
        }
        else {
            return null;
        }

        // Расстояние от начала координат до прямой:
        // |C| / sqrt(A^2 + B^2)
        const distance = Math.abs(C) / Math.hypot(A, B);

        // Угол прямой в градусах.
        // Направляющий вектор прямой: (B, -A)
        let angle = Math.atan2(-A, B) * 180 / Math.PI;

        // Приводим угол к диапазону 0..180
        if (angle < 0) {
            angle += 180;
        }

        return {
            A,
            B,
            C,
            distance,
            angle
        };
    }


}
LiteGraph.registerNodeType("search/LineSearch", LineSearch);
