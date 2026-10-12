// Ядро детекции границ по Собелю (аналог узла "Собель").
// Чистая функция без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    // Ядра Собеля для вычисления градиентов
    const SOBEL_KX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const SOBLE_KY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    /**
     * Детекция границ по Собелю: для каждого пикселя вычисляется magnitude
     * градиента sqrt(gx^2 + gy^2) по 3x3 окну.
     * @param {number} height - Высота матрицы.
     * @param {number} width - Ширина матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function sobelMatrix(height, width, matrix) {
        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));
        let max_value = -Infinity;
        let min_value = Infinity;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let gxSum = 0, gySum = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const px = x + kx;
                        const py = y + ky;

                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            gxSum += matrix[py][px] * SOBEL_KX[ky + 1][kx + 1];
                            gySum += matrix[py][px] * SOBLE_KY[ky + 1][kx + 1];
                        }
                    }
                }

                data[y][x] = Math.sqrt(gxSum * gxSum + gySum * gySum);

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

    K.sobelMatrix = sobelMatrix;
})();
