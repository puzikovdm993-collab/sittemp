// Ядро поворота матрицы (аналог узла "Повернуть").
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
     * Поворот матрицы на угол (в градусах) вокруг её центра.
     * Размер результирующей матрицы вычисляется так, чтобы вписать
     * повёрнутый прямоугольник исходной матрицы.
     * @param {number} height - Высота исходной матрицы.
     * @param {number} width - Ширина исходной матрицы.
     * @param {number[][]} matrix - Исходная матрица (массив массивов).
     * @param {number} angleDeg - Угол поворота в градусах.
     * @param {{fillValue?: number}} [options] - Настройки.
     * @returns {{data:number[][], min_value:number, max_value:number, width:number, height:number}}
     */
    function rotateMatrix(height, width, matrix, angleDeg, options = {}) {
        const fillValue = options.fillValue !== undefined ? options.fillValue : 0;
        const angle = Number(angleDeg) || 0;

        const rad = (angle * Math.PI) / 180;

        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));

        const nw = Math.round(width * cos + height * sin);
        const nh = Math.round(width * sin + height * cos);

        const c = Math.cos(rad);
        const s = Math.sin(rad);

        const srcCx = (width - 1) / 2;
        const srcCy = (height - 1) / 2;
        const dstCx = (nw - 1) / 2;
        const dstCy = (nh - 1) / 2;

        const data = new Array(nh);

        for (let y = 0; y < nh; y++) {
            const row = new Array(nw);
            data[y] = row;

            const dy = y - dstCy;

            for (let x = 0; x < nw; x++) {
                const dx = x - dstCx;

                // Обратное преобразование координат:
                // выходной пиксель -> исходная матрица
                const u = dx * c + dy * s + srcCx;
                const v = -dx * s + dy * c + srcCy;

                row[x] = sampleMatrix(matrix, width, height, u, v, fillValue);
            }
        }

        let min_value = Infinity;
        let max_value = -Infinity;

        for (let y = 0; y < nh; y++) {
            for (let x = 0; x < nw; x++) {
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
            width: nw,
            height: nh
        };
    }

    K.rotateMatrix = rotateMatrix;
})();

