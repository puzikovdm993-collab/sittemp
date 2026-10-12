// Ядро поэлементного деления двух матриц (аналог узла "Деление").
// Чистая функция без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Поэлементное деление matrixA на matrixB: каждый пиксель результата равен
     * a / b. Для защиты от деления на ноль используется epsilon.
     * Матрицы должны быть одинакового размера (проверяется вызывающим кодом).
     * @param {number} height - Высота матриц.
     * @param {number} width - Ширина матриц.
     * @param {number[][]} matrixA - Делимая матрица (массив массивов).
     * @param {number[][]} matrixB - Делитель (массив массивов).
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function divisionMatrix(height, width, matrixA, matrixB) {
        const epsilon = 0.0001;

        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));
        let min_value = Infinity;
        let max_value = -Infinity;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const a = matrixA[y][x] ?? 0;
                const b = matrixB[y][x] ?? 0;

                // Защита от деления на ноль
                const denominator = Math.abs(b) < epsilon ? epsilon : b;

                const value = a / denominator;
                data[y][x] = value;

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

    K.divisionMatrix = divisionMatrix;
})();
