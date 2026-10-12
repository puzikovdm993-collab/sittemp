class CircleSearch extends FilterNode {
    constructor() {
        super();
        this.title = "Поиск окружности";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" 
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);

        this.addOutput("CurcleCenter", Types.NUMBER1);


        this.size = [250, 100];
        this.resizable = false;
        this.circleResult = null;
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
        
        const result = this._circle_search(inputData.width, inputData.height, inputData.data);
        this.circleResult = result;
        this.properties.circleResult = result;

        // console.log(result)
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
                x: result.x, 
                y: result.y,
                radius: result.radius
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
    
        const res = (this.properties && this.properties.circleResult) || this.circleResult;
    
        if (
            !res ||
            !Number.isFinite(res.x) ||
            !Number.isFinite(res.y) ||
            !Number.isFinite(res.radius) ||
            res.radius < 0
        ) {
            ctx.fillText("Результат: нет", pad, y);
        } else {
            ctx.fillText(`Центр: (${res.x.toFixed(2)}, ${res.y.toFixed(2)})`, pad, y);
            ctx.fillText(`Радиус: ${res.radius.toFixed(2)}`, pad, y + 16);
        }
    
        ctx.restore();
    }
    
    _circle_search(height, width, matrix) {
        const boundaryX = [];
        const boundaryY = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if(matrix[y][x] == 1) {
                    boundaryX.push(x);
                    boundaryY.push(y);
                }
            }
        }
        const res = this._circleSearch(boundaryX.length, boundaryX, boundaryY);
        // console.log(res);

        return { 
            x: res.center[0], 
            y: res.center[1],
            radius: res.radius
        };
    }

    /**
     * Поиск центров окружности методом наименьших квадратов (5 итераций)
     * @param {number} count_points - Количество точек
     * @param {Float32Array} X - Массив X-координат точек
     * @param {Float32Array} Y - Массив Y-координат точек
     * @param {number} [num_iter=5] - Количество итераций (по умолчанию 5)
     */
    _circleSearch(count_points, X, Y, num_iter = 5) {
        // Начальное приближение (центр масс точек)
        let x_center = 0.0;
        let y_center = 0.0;
        let Radius  = 0.0;    // Сумма квадратов расстояний от начального центра
        for (let i = 0; i < count_points; i++) {
            x_center += X[i];
            y_center += Y[i];
        }
        x_center /= count_points;
        y_center /= count_points;
    
        // Итеративное уточнение центра и радиуса
        for (let ni = 0; ni < num_iter; ni++) {
            let RR = 0.0;    // Сумма квадратов расстояний от начального центра
            let X1 = 0.0;
            let Y1 = 0.0;
            let dX_dx = 0.0;
            let dX_dy = 0.0;
            let dY_dx = 0.0;
            let dY_dy = 0.0;

            // Вычисляем среднее значение RR (квадрат радиуса)
            for (let i = 0; i < count_points; i++) {
                const dx = X[i] - x_center;
                const dy = Y[i] - y_center;
                RR += dx * dx + dy * dy;
            }
            RR /= count_points;

            // Вычисляем суммы для поправок X1 и Y1
            for (let i = 0; i < count_points; i++) {
                const dx = X[i] - x_center;
                const dy = Y[i] - y_center;
                const term = (dx * dx + dy * dy - RR);
                
                X1 += term * X[i];
                Y1 += term * Y[i];
            }

            // Матрица производных (dX_dx, dX_dy, dY_dx, dY_dy)
            let xx = 0.0, xy = 0.0, yx = 0.0, yy = 0.0;
            
            for (let i = 0; i < count_points; i++) {
                xx = xy = yx = yy = 0.0;

                for (let j = 0; j < count_points; j++) {
                    xx += X[j] - X[i];
                    yy += Y[j] - Y[i];
                }
                
                xy = yy;  // Симметрия матрицы (dX_dy = dY_dx)
                yx = xx;

                // Нормализация (деление на количество точек)
                xx *= X[i] / count_points;
                xy *= X[i] / count_points;
                yx *= Y[i] / count_points;
                yy *= Y[i] / count_points;

                // Накопление сумм для матрицы Гессе
                dX_dx += xx;
                dX_dy += xy;
                dY_dx += yx;
                dY_dy += yy;
            }

            // Удвоение производных (как в C#)
            dX_dx *= 2.0;
            dX_dy *= 2.0;
            dY_dx *= 2.0;
            dY_dy *= 2.0;

            // Вычисление поправок
            const D1 = dX_dx * x_center + dX_dy * y_center - X1;
            const D2 = dY_dx * x_center + dY_dy * y_center - Y1;

            // Решение системы уравнений методом Крамера
            let x_new, y_new;
            
            // Избегаем деления на ноль
            if (dX_dx === 0) {
                // Вырожденный случай - можно добавить обработку по необходимости
                y_new = (D2 / dY_dy) || 0;
                x_new = (D1 - dX_dy * y_new) / (dX_dx + 0.0001); // Добавляем epsilon
            } else {
                y_new = (D2 - D1 * dY_dx / dX_dx) / (dY_dy - dX_dy * dY_dx / dX_dx);
                x_new = (D1 - dX_dy * y_new) / dX_dx;
            }

            // Обновляем центр окружности
            x_center = x_new;
            y_center = y_new;

            // Вычисляем итоговый радиус
        //const RR = 0.0; // На последней итерации RR уже содержит среднее значение
        Radius = Math.sqrt(RR);
        }



        return { center: [x_center, y_center], radius: Radius };
    }

    _findCircle(boundaryPoints) {
        let { centerX, centerY } = getInitialGuess(boundaryPoints);
        let radius = 0;
        const numPoints = boundaryPoints.length;
        const numIterations = 1;
        console.log('centerX = ' + centerX);
        console.log('centerY = ' + centerY);

        for (let iter = 0; iter < numIterations; iter++) {
            let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, sumYY = 0;
            
            for (const [x, y] of boundaryPoints) {
                const dx = x - centerX;
                const dy = y - centerY;
                const distSq = dx * dx + dy * dy;
                
                sumX += dx * (distSq - radius);
                sumY += dy * (distSq - radius);
                sumXX += distSq * dx;
                sumXY += distSq * dy;
                sumYY += dy * dy * dx;
            }

            console.log('sumXX = ' + sumXX);
            console.log('sumXY = ' + sumXY);
            console.log('sumXY = ' + sumXY);
            console.log('sumXY = ' + sumXY);
            console.log('numPoints = ' + numPoints);
        

            const denominator = numPoints * (sumXX * sumXY - sumXY * sumXY);
            console.log(denominator);
            const newCenterX = (sumXX * centerY - sumXY * centerX) / denominator;
            const newCenterY = (sumXY * centerX - sumYY * centerY) / denominator;
            const newRadius = (sumXX * (newCenterX - centerX) + sumXY * (newCenterY - centerY)) / numPoints;


            console.log('sumXX * sumXY - sumXY * sumXY = ' + (sumXX * sumXY - sumXY * sumXY));

            console.log('newCenterX = ' + newCenterX);
            console.log('newCenterY = ' + newCenterY);
            

            centerX = newCenterX;
            centerY = newCenterY;
            radius = newRadius;
        }

        return {
            centerX: Math.round(centerX * 100) / 100,
            centerY: Math.round(centerY * 100) / 100,
            radius: Math.round(radius * 100) / 100
        };
    }

    _getInitialGuess(points) {
        let sumX = 0, sumY = 0;
        for (const [x, y] of points) {
            sumX += x;
            sumY += y;
        }
        return {
            centerX: sumX / points.length,
            centerY: sumY / points.length
        };
    }

    _detectBoundary(imageData, width, height, maxValue) {
        const boundary = [];
        const data = imageData.data;
        const stride = imageData.width * 4; // RGBA
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const offset = y * stride + x * 4;
                
                // Проверяем, является ли текущий пиксель частью границы
                const centerValue = data[offset];
                if (centerValue === maxValue) {
                    let isBoundary = false;
                    const indices = [
                        // 3x3 neighborhood (top-left to bottom-right)
                        (y-1)*stride + (x-1)*4, // NW
                        (y-1)*stride + x*4,     // N
                        (y-1)*stride + (x+1)*4, // NE
                        y*stride + (x-1)*4,     // W
                        offset,                   // C
                        y*stride + (x+1)*4,     // E
                        (y+1)*stride + (x-1)*4, // SW
                        (y+1)*stride + x*4,     // S
                        (y+1)*stride + (x+1)*4  // SE
                    ];

                    const values = indices.map(i => data[i]);
                    if (values.some(v => v === 0)) {
                        boundary.push([x, y]);
                        data[offset] = 0; // Помечаем как границу (может потребоваться сохранение оригинала)
                    }
                }
            }
        }

        return boundary;
    }
}
LiteGraph.registerNodeType("search/CircleSearch", CircleSearch);
