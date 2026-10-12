// Ядро полиномиальной коррекции фона (апроксимации поверхностью).
// Аналог узла "Апроксимация поверхностью". Чистая функция без DOM и LiteGraph.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Вычисляет общее количество коэффициентов K для двумерного многочлена заданного порядка.
     * @param {number} order - Порядок многочлена (степень).
     * @returns {number}
     */
    function calculateK(order) {
        return (order + 1) * (order + 2) / 2 - 1;
    }

    /**
     * Генерирует вектор базисных функций (мономов) для точки (x, y).
     * @param {number} x - Координата X.
     * @param {number} y - Координата Y.
     * @param {number} order - Порядок многочлена.
     * @param {number} k - Общее количество коэффициентов.
     * @returns {Float64Array}
     */
    function getPolynomialTerms(x, y, order, k) {
        const a = new Float64Array(k + 1);
        a[0] = 1.0;

        let pos = 1;
        for (let l = 0; l < order + 1; l++) {
            const numElementsInLine = l + 2;
            for (let li = 0; li < numElementsInLine; li++) {
                a[pos] = Math.pow(x, numElementsInLine - li - 1) * Math.pow(y, li);
                pos++;
            }
        }
        return a;
    }

    /**
     * Решает СЛАУ методом Гаусса.
     * @param {Float64Array[]} sums - Матрица коэффициентов.
     * @param {Float64Array} b - Вектор свободных членов.
     * @returns {Float64Array|null} Вектор коэффициентов или null.
     */
    function solveLinearSystem(sums, b) {
        const size = b.length;
        const result = new Float64Array(size);

        const s = sums.map(row => new Float64Array(row));
        const v = new Float64Array(b);

        // Пивотирование
        for (let i = 0; i < size; i++) {
            if (s[i][i] === 0) {
                for (let j = 0; j < size; j++) {
                    if (j !== i && s[j][i] !== 0 && s[i][j] !== 0) {
                        [s[i], s[j]] = [s[j], s[i]];
                        [v[i], v[j]] = [v[j], v[i]];
                        break;
                    }
                }
            }
        }

        // Прямой ход
        for (let k = 0; k < size; k++) {
            for (let i = k + 1; i < size; i++) {
                if (s[k][k] === 0) return null;
                const m = s[i][k] / s[k][k];
                for (let j = k; j < size; j++) {
                    s[i][j] -= m * s[k][j];
                }
                v[i] -= m * v[k];
            }
        }

        // Обратный ход
        for (let i = size - 1; i >= 0; i--) {
            let sum = 0;
            for (let j = i + 1; j < size; j++) {
                sum += s[i][j] * result[j];
            }
            result[i] = (v[i] - sum) / s[i][i];
        }

        return result;
    }

    /**
     * Полиномиальная апроксимация фона. Строит поверхность наименьших квадратов
     * по точкам обучения (roisPixels) и вычисляет значения фона.
     * @param {number} height - Высота матрицы.
     * @param {number} width - Ширина матрицы.
     * @param {number[][]} matrix - Входная матрица (массив массивов).
     * @param {{order:number, allArea:boolean, roisPixels:Array<[number,number]>}} params - Параметры.
     * @returns {{data:number[][], min_value:number, max_value:number}}
     */
    function approximateBackgroundMatrix(height, width, matrix, params) {
        const { order, allArea, roisPixels } = params;
        const k = calculateK(order);
        const usePoints = Array.isArray(roisPixels) && roisPixels.length > 0;

        // Плоское представление (row-major: index = y * width + x)
        const srcData = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                srcData[y * width + x] = matrix[y][x];
            }
        }

        // Матрица нормальных уравнений и вектор правых частей
        const sums = Array.from({ length: k + 1 }, () => new Float64Array(k + 1));
        const b = new Float64Array(k + 1);
        let n = 0;

        const accumulate = (x, y) => {
            n++;
            const a = getPolynomialTerms(x, y, order, k);
            for (let i = 0; i < k + 1; i++) {
                for (let j = 0; j < k + 1; j++) {
                    sums[i][j] += a[j] * a[i];
                }
                b[i] += a[i] * srcData[y * width + x];
            }
        };

        if (usePoints) {
            for (const pixel of roisPixels) {
                const x = pixel[0];
                const y = pixel[1];
                if (x < 0 || x >= width || y < 0 || y >= height) continue;
                accumulate(x, y);
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    accumulate(x, y);
                }
            }
        }

        // Защита: точек должно быть больше, чем неизвестных
        if (n <= 2 * k) {
            console.warn("Недостаточно точек для построения поверхности. Требуется N > 2*K.");
            const data = matrix.map(row => row.slice());
            let max_value = -Infinity;
            let min_value = Infinity;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (data[y][x] > max_value) max_value = data[y][x];
                    if (data[y][x] < min_value) min_value = data[y][x];
                }
            }
            return { data: data, min_value: min_value, max_value: max_value };
        }

        const coefficients = solveLinearSystem(sums, b);
        if (!coefficients) {
            console.error("Система уравнений вырождена и не имеет решения.");
            const data = matrix.map(row => row.slice());
            let max_value = -Infinity;
            let min_value = Infinity;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (data[y][x] > max_value) max_value = data[y][x];
                    if (data[y][x] < min_value) min_value = data[y][x];
                }
            }
            return { data: data, min_value: min_value, max_value: max_value };
        }

        const applyPoint = (x, y) => {
            const a = getPolynomialTerms(x, y, order, k);
            let val = 0;
            for (let i = 0; i < k + 1; i++) {
                val += coefficients[i] * a[i];
            }
            return val;
        };

        // Результат: исходные значения, заменённые фоном где нужно
        const data = new Array(height).fill(0).map(() => new Array(width).fill(0));
        let max_value = -Infinity;
        let min_value = Infinity;

        if (allArea) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    data[y][x] = applyPoint(x, y);
                    if (data[y][x] > max_value) max_value = data[y][x];
                    if (data[y][x] < min_value) min_value = data[y][x];
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    data[y][x] = matrix[y][x];
                }
            }
            for (const pixel of roisPixels) {
                const x = pixel[0];
                const y = pixel[1];
                if (x < 0 || x >= width || y < 0 || y >= height) continue;
                data[y][x] = applyPoint(x, y);
            }
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (data[y][x] > max_value) max_value = data[y][x];
                    if (data[y][x] < min_value) min_value = data[y][x];
                }
            }
        }

        return {
            data: data,
            min_value: min_value,
            max_value: max_value
        };
    }

    K.approximateBackgroundMatrix = approximateBackgroundMatrix;
})();
