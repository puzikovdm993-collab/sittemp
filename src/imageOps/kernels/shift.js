// Ядро смещения матрицы (аналог узлов "Сместить" / "Сместить в центр").
// Чистая функция без DOM и LiteGraph: параметры передаются явно.
// Сэмплинг: bilinear. Пиксели за границей исходной матрицы заполняются fillValue.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Билинейная интерполяция значения в точке (u, v) исходной матрицы.
     * @param {number[][]} matrix - Исходная матрица (массив массивов).
     * @param {number} width - Ширина матрицы.
     * @param {number} height - Высота матрицы.
     * @param {number} u - X-координата в исходной матрице.
     * @param {number} v - Y-координата в исходной матрице.
     * @param {number} fillValue - Значение для точек за границей.
     * @returns {number}
     */
    function sampleMatrix(matrix, width, height, u, v, fillValue) {
        const eps = 1e-9;

        if (u < -eps || u > width - 1 + eps || v < -eps || v > height - 1 + eps) {
            return fillValue;
        }

        u = Math.max(0, Math.min(width - 1, u));
        v = Math.max(0, Math.min(height - 1, v));

        const x0 = Math.floor(u);
        const y0 = Math.floor(v);

        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);

        const fx = u - x0;
        const fy = v - y0;

        const top = matrix[y0][x0] * (1 - fx) + matrix[y0][x1] * fx;
        const bottom = matrix[y1][x0] * (1 - fx) + matrix[y1][x1] * fx;

        return top * (1 - fy) + bottom * fy;
    }

    /**
     * Сдвиг матрицы на (shiftX, shiftY) пикселей.
     * Размер результирующей матрицы совпадает с исходной.
     * Пиксели за границей исходной матрицы заполняются fillValue.
     * @param {number} height - Высота исходной матрицы.
     * @param {number} width - Ширина исходной матрицы.
     * @param {number[][]} matrix - Исходная матрица (массив массивов).
     * @param {number} shiftX - Смещение по X (пиксели).
     * @param {number} shiftY - Смещение по Y (пиксели).
     * @param {{fillValue?: number}} [options] - Настройки.
     * @returns {{data:number[][], min_value:number, max_value:number, width:number, height:number}}
     */
    function shiftMatrix(height, width, matrix, shiftX, shiftY, options = {}) {
        const fillValue = options.fillValue !== undefined ? options.fillValue : 0;
        const sx = Number(shiftX) || 0;
        const sy = Number(shiftY) || 0;

        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                data[y][x] = sampleMatrix(matrix, width, height, x - sx, y - sy, fillValue);
            }
        }

        let min_value = Infinity;
        let max_value = -Infinity;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[y][x] > max_value) {
                    max_value = data[y][x];
                }

                if (data[y][x] < min_value) {
                    min_value = data[y][x];
                }
            }
        }

        return {
            data: data,
            min_value: min_value,
            max_value: max_value,
            width: width,
            height: height
        };
    }

    K.shiftMatrix = shiftMatrix;
})();

