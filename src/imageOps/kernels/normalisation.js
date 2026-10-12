// Ядро нормализации матрицы (аналог узла "Нормировка").
// Чистая функция без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Линейная нормализация матрицы: значения масштабируются из диапазона
     * [minValue, maxValue] в [min_norm, max_norm] с ограничением (clip).
     * @param {number} height - Высота матрицы.
     * @param {number} width - Ширина матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {number} minValue - Минимум входного диапазона.
     * @param {number} maxValue - Максимум входного диапазона.
     * @param {{min_norm:number, max_norm:number}} params - Целевой диапазон.
     * @param {Array<[number,number]>} [sel] - Необязательный список точек [x, y] (маска: обработка только внутри).
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function normalizeMatrix(height, width, matrix, minValue, maxValue, params, sel = null) {
        const { min_norm, max_norm } = params;

        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));
        let max_value = -Infinity;
        let min_value = Infinity;

        const range = maxValue - minValue;
        const range_norm = max_norm - min_norm;

        const normalizeValue = (value) => {
            const normalizedValue1 = ((value - minValue) / range) * (range_norm) + min_norm;
            return Math.min(max_norm, Math.max(min_norm, normalizedValue1));
        };

        if (!sel) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    data[y][x] = normalizeValue(matrix[y][x]);

                    if (data[y][x] > max_value) {
                        max_value = data[y][x];
                    }

                    if (data[y][x] < min_value) {
                        min_value = data[y][x];
                    }
                }
            }
        } else {
            const mask = maskFromPoints(width, height, sel);

            for (let y = 0; y < height; y++) {
                const rowOffset = y * width;
                for (let x = 0; x < width; x++) {
                    if (mask[rowOffset + x]) {
                        data[y][x] = normalizeValue(matrix[y][x]);
                    } else {
                        data[y][x] = matrix[y][x];
                    }

                    if (data[y][x] > max_value) {
                        max_value = data[y][x];
                    }

                    if (data[y][x] < min_value) {
                        min_value = data[y][x];
                    }
                }
            }
        }

        return {
            data: data,
            min_value: min_value,
            max_value: max_value
        };
    }

    K.normalizeMatrix = normalizeMatrix;
})();
