// Ядро логарифмирования матрицы (аналог узла "Логарифмирование").
// Чистая функция без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Натуральное логарифмирование матрицы: значение каждого пикселя заменяется
     * на Math.log(value). Для некорректных (<= 0) значений берётся 0.
     * @param {number} height - Высота матрицы.
     * @param {number} width - Ширина матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {Array<[number,number]>} [sel] - Необязательный список точек [x, y] (маска: обработка только внутри).
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function logarithmMatrix(height, width, matrix, sel = null) {
        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));
        let max_value = -Infinity;
        let min_value = Infinity;

        const applyLog = (value) => {
            const a = Number(value);
            if (!Number.isFinite(a) || a <= 0) {
                return 0;
            }
            return Math.log(a);
        };

        if (!sel) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    data[y][x] = applyLog(matrix[y][x]);

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
                        data[y][x] = applyLog(matrix[y][x]);
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

    K.logarithmMatrix = logarithmMatrix;
})();

