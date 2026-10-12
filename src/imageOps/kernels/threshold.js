// Ядро пороговой обработки матрицы (аналог узла "Порог").
// Чистые функции без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Пороговая обработка матрицы: значения выше node_max заменяются node_more_max,
     * значения ниже node_min заменяются node_less_min.
     * @param {number} height - Высота матрицы.
     * @param {number} width - Ширина матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {{node_min:number, node_less_min:number, node_max:number, node_more_max:number}} params - Параметры порогов.
     * @param {Array<[number,number]>} [sel] - Необязательный список точек [x, y] (маска: обработка только внутри).
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function thresholdMatrix(height, width, matrix, params, sel = null) {
        const { node_min, node_less_min, node_max, node_more_max } = params;

        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));

        if (!sel) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    data[y][x] = matrix[y][x];

                    if (data[y][x] > node_max) {
                        data[y][x] = node_more_max;
                    }

                    if (data[y][x] < node_min) {
                        data[y][x] = node_less_min;
                    }
                }
            }
        } else {
            const mask = maskFromPoints(width, height, sel);

            for (let y = 0; y < height; y++) {
                const rowOffset = y * width;
                for (let x = 0; x < width; x++) {
                    data[y][x] = matrix[y][x];

                    if (!mask[rowOffset + x]) {
                        continue;
                    }

                    if (data[y][x] > node_max) {
                        data[y][x] = node_more_max;
                    }

                    if (data[y][x] < node_min) {
                        data[y][x] = node_less_min;
                    }
                }
            }
        }

        let max_value = -Infinity;
        let min_value = Infinity;

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
            max_value: max_value
        };
    }

    /**
     * Находит границы (bounding box) точек, где значение матрицы выше порога.
     * @param {number[][]} matrix - Матрица.
     * @param {Array<[number,number]>} points - Точки [x, y].
     * @param {number} threshold - Порог.
     * @returns {{minX:number, minY:number, maxX:number, maxY:number}|null}
     */
    function findMaskBounds(matrix, points, threshold) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < points.length; i++) {
            const x = points[i][0];
            const y = points[i][1];
            const value = Number(matrix[y][x]);

            if (Number.isFinite(value) && value > threshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < 0 || maxY < 0) {
            return null;
        }

        return {
            minX,
            minY,
            maxX,
            maxY
        };
    }

    K.thresholdMatrix = thresholdMatrix;
    K.findMaskBounds = findMaskBounds;
})();

