// Ядра обрезки матрицы (аналоги узлов "Обрезка" и "Обрезка по маске").
// Чистые функции без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Простая прямоугольная обрезка матрицы.
     * @param {number} height - Высота исходной матрицы.
     * @param {number} width - Ширина исходной матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {number} x - Левая граница (по X).
     * @param {number} y - Верхняя граница (по Y).
     * @param {number} w - Ширина области.
     * @param {number} h - Высота области.
     * @returns {{data:number[][], width:number, height:number, min_value:number, max_value:number}}
     */
    function cropMatrix(height, width, matrix, x, y, w, h) {
        const data = new Array(h).fill(0).map(() => new Array(w).fill(0));
        let max_value = -Infinity;
        let min_value = Infinity;

        for (let yj = 0; yj < h; yj++) {
            for (let xi = 0; xi < w; xi++) {
                const value = matrix[y + yj][x + xi];
                data[yj][xi] = value;

                if (value > max_value) {
                    max_value = value;
                }

                if (value < min_value) {
                    min_value = value;
                }
            }
        }

        return {
            data: data,
            width: w,
            height: h,
            min_value: min_value,
            max_value: max_value
        };
    }

    /**
     * Обрезка матрицы по маске: внутри области [x, y, w, h] сохраняются значения
     * пикселей, отмеченных в маске, остальные заполняются значением fillValue.
     * @param {number} height - Высота исходной матрицы.
     * @param {number} width - Ширина исходной матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {Uint8Array} mask - Маска (row-major, index = y * width + x).
     * @param {number} x - Левая граница (по X).
     * @param {number} y - Верхняя граница (по Y).
     * @param {number} w - Ширина области.
     * @param {number} h - Высота области.
     * @param {number} fillValue - Значение для пикселей вне маски.
     * @returns {{data:number[][], width:number, height:number, min_value:number, max_value:number}}
     */
    function cropByMaskMatrix(height, width, matrix, mask, x, y, w, h, fillValue) {
        const data = new Array(h).fill(0).map(() => new Array(w).fill(fillValue));
        let max_value = -Infinity;
        let min_value = Infinity;

        for (let yj = 0; yj < h; yj++) {
            const rowOffset = (y + yj) * width;
            for (let xi = 0; xi < w; xi++) {
                if (!mask[rowOffset + (x + xi)]) {
                    continue;
                }

                const value = matrix[y + yj][x + xi];
                data[yj][xi] = value;

                if (value > max_value) {
                    max_value = value;
                }

                if (value < min_value) {
                    min_value = value;
                }
            }
        }

        return {
            data: data,
            width: w,
            height: h,
            min_value: min_value,
            max_value: max_value
        };
    }

    K.cropMatrix = cropMatrix;
    K.cropByMaskMatrix = cropByMaskMatrix;
})();

