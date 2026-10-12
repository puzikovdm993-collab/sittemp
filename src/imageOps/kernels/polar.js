// Ядра преобразования между полярной и декартовой системами координат
// (аналог узла "Полярные координаты").
// Чистые функции без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Преобразование из декартовой системы в полярную.
     * Каждая строка результирующей матрицы соответствует углу,
     * каждый столбец — радиусу. Значения берутся билинейной интерполяцией
     * из исходной матрицы.
     * @param {number} height - Высота исходной матрицы.
     * @param {number} width - Ширина исходной матрицы.
     * @param {number[][]} matrix - Исходная матрица (массив массивов).
     * @param {number} center_x - X координата центра.
     * @param {number} center_y - Y координата центра.
     * @param {number} dAngle - Шаг по углу (в градусах).
     * @param {number} angle0 - Начальный угол (в градусах).
     * @param {number} newHeight - Высота результирующей матрицы (число углов).
     * @param {number} newWidth - Ширина результирующей матрицы (число радиусов).
     * @param {number} dr - Шаг по радиусу.
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function polarToCartesianMatrix(height, width, matrix, center_x, center_y, dAngle, angle0, newHeight, newWidth, dr) {
        let angle, dx, dy, val, ind_x0, ind_x1, ind_y0, ind_y1;
        let coord_x, coord_y, dc_x, dc_y, a, b;

        const Res = new Array(newHeight);

        for (let i = 0; i < newHeight; i++) {
            Res[i] = new Array(newWidth);
            angle = (2.0 * Math.PI * (angle0 + dAngle * i)) / 360.0;
            dx = dr * Math.sin(angle);
            dy = dr * Math.cos(angle);

            for (let j = 0; j < newWidth; j++) {
                coord_y = center_y + dy * j;
                coord_x = center_x + dx * j;

                // Граничные условия
                if (coord_x >= width - 1) coord_x = width - 2;
                if (coord_y >= height - 1) coord_y = height - 2;
                if (coord_x < 0) coord_x = 0.0;
                if (coord_y < 0) coord_y = 0.0;

                ind_y0 = Math.floor(coord_y);
                ind_x0 = Math.floor(coord_x);
                ind_x1 = ind_x0 + 1;
                ind_y1 = ind_y0 + 1;

                dc_x = coord_x - ind_x0;
                dc_y = coord_y - ind_y0;

                val = 0.0;
                if (ind_y0 >= 0 && ind_y0 < height && ind_x0 >= 0 && ind_x0 < width && ind_y1 >= 0 && ind_y1 < height && ind_x1 >= 0 && ind_x1 < width) {
                    a = matrix[ind_y0][ind_x0] + dc_x * (matrix[ind_y0][ind_x1] - matrix[ind_y0][ind_x0]);
                    b = matrix[ind_y1][ind_x0] + dc_x * (matrix[ind_y1][ind_x1] - matrix[ind_y1][ind_x0]);
                    val = a + dc_y * (b - a);
                }

                Res[i][j] = val;
            }
        }

        let max_value = -Infinity;
        let min_value = Infinity;
        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                if (Res[y][x] > max_value) {
                    max_value = Res[y][x];
                }
                if (Res[y][x] < min_value) {
                    min_value = Res[y][x];
                }
            }
        }

        return {
            data: Res,
            min_value: min_value,
            max_value: max_value
        };
    }

    /**
     * Преобразование из полярной системы в декартовую.
     * Первый проход определяет minAngle, второй — само преобразование.
     * @param {number} height - Высота исходной матрицы.
     * @param {number} width - Ширина исходной матрицы.
     * @param {number[][]} matrix - Исходная матрица (массив массивов).
     * @param {number} center_x - X координата центра.
     * @param {number} center_y - Y координата центра.
     * @param {number} dAngle - Шаг по углу (в градусах).
     * @param {number} angle0 - Начальный угол (в градусах).
     * @param {number} newHeight - Высота результирующей матрицы.
     * @param {number} newWidth - Ширина результирующей матрицы.
     * @param {number} dr - Шаг по радиусу.
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function cartesianToPolarMatrix(height, width, matrix, center_x, center_y, dAngle, angle0, newHeight, newWidth, dr) {
        let minAngle = Infinity;
        let r_x, r_y, R, ang_x, angle;

        // Первый проход - определение minAngle
        for (let i = 0; i < newHeight; i++) {
            r_y = (-center_y + i) / dr;
            for (let j = 0; j < newWidth; j++) {
                r_x = (-center_x + j) / dr;
                R = Math.sqrt(r_y * r_y + r_x * r_x);
                if (R < 0.001) R = 0.001;

                ang_x = Math.asin(r_y / R);
                angle = angle0 + ang_x;
                if (angle < minAngle) minAngle = angle;
            }
        }

        // Корректировка angle0
        angle0 = Math.PI + (dAngle / 2.0) * (2.0 * Math.PI / 360.0);

        // Второй проход - само преобразование
        const Res = new Array(newHeight);
        for (let i = 0; i < newHeight; i++) {
            Res[i] = new Array(newWidth);
            r_y = (-center_y + i) / dr;
            for (let j = 0; j < newWidth; j++) {
                r_x = (-center_x + j) / dr;
                R = Math.sqrt(r_y * r_y + r_x * r_x);
                if (R < 0.001) R = 0.001;

                ang_x = Math.asin(r_y / R);
                angle = 360.0 * ((angle0 + ang_x - minAngle) / (dAngle * 2.0 * Math.PI));

                // Коррекция для правой полуплоскости
                if (r_x > 0.0) {
                    angle = (height + 1.0) - angle;
                }

                // Граничные условия
                let angleInt = Math.floor(angle);
                if (angleInt < 0 || angleInt >= height || Math.floor(R) >= width) {
                    Res[i][j] = 0.0;
                } else {
                    Res[i][j] = matrix[angleInt][Math.floor(R)];
                }
            }
        }

        let max_value = -Infinity;
        let min_value = Infinity;
        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                if (Res[y][x] > max_value) {
                    max_value = Res[y][x];
                }
                if (Res[y][x] < min_value) {
                    min_value = Res[y][x];
                }
            }
        }

        return {
            data: Res,
            min_value: min_value,
            max_value: max_value
        };
    }

    K.polarToCartesianMatrix = polarToCartesianMatrix;
    K.cartesianToPolarMatrix = cartesianToPolarMatrix;
})();
