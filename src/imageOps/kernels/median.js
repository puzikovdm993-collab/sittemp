// Ядро медианной фильтрации матрицы (аналог узла "Медианный фильтр").
// Чистая функция без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Медианная фильтрация матрицы окном kernelSize × kernelSize.
     * Для обработки краёв матрица расширяется нулевыми границами (pad).
     * @param {number} height - Высота матрицы.
     * @param {number} width - Ширина матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {number} kernelSize - Размер окна фильтра (нечетное, например 3).
     * @param {Array<[number,number]>} [sel] - Необязательный список точек [x, y] (маска: обработка только внутри).
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function medianMatrix(height, width, matrix, kernelSize = 3, sel = null) {
        // Размер окна должен быть нечетным и >= 1
        kernelSize = Math.max(1, Math.floor(kernelSize));
        if (kernelSize % 2 === 0) {
            kernelSize -= 1;
        }

        const padSize = Math.floor(kernelSize / 2);
        const padded = createPaddedMatrix(matrix, padSize);

        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));
        let max_value = -Infinity;
        let min_value = Infinity;

        const mask = sel ? maskFromPoints(width, height, sel) : null;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (mask && !mask[y * width + x]) {
                    // Вне выделенной области оставляем исходное значение
                    data[y][x] = matrix[y][x];
                } else {
                    const window = extractWindow(padded, x + padSize, y + padSize, kernelSize);
                    data[y][x] = calculateMedian(window);
                }

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
     * Создаёт расширенную матрицу с нулевыми границами для обработки краев.
     * @param {number[][]} matrix - Исходная матрица.
     * @param {number} padSize - Размер отступа.
     * @returns {number[][]}
     */
    function createPaddedMatrix(matrix, padSize) {
        const m = matrix.length;
        const n = matrix[0].length;
        const padded = new Array(m + 2 * padSize);

        for (let i = 0; i < padded.length; i++) {
            padded[i] = new Array(n + 2 * padSize).fill(0);
        }

        // Копируем исходную матрицу в центр расширенной
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                padded[i + padSize][j + padSize] = matrix[i][j];
            }
        }

        return padded;
    }

    /**
     * Извлекает подматрицу (окрестность) размера size × size с центром в (cx, cy).
     * @param {number[][]} matrix - Расширенная матрица.
     * @param {number} cx - Центр по x.
     * @param {number} cy - Центр по y.
     * @param {number} size - Размер окна.
     * @returns {number[]}
     */
    function extractWindow(matrix, cx, cy, size) {
        const half = Math.floor(size / 2);
        const window = [];

        for (let i = cy - half; i <= cy + half; i++) {
            for (let j = cx - half; j <= cx + half; j++) {
                window.push(matrix[i][j]);
            }
        }

        return window;
    }

    /**
     * Вычисляет медиану массива чисел.
     * @param {number[]} arr - Массив значений.
     * @returns {number}
     */
    function calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    K.medianMatrix = medianMatrix;
})();

