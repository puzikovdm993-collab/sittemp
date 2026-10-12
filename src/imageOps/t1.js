
// Вычисление коэффициентов полинома методом наименьших квадратов
function _computePolynomialCoefficients(matrix, width, height, order, allArea) {
                
    // 1. Подсчет точек и коэффициентов
    // N — общее число точек
    // K — число коэффициентов полинома
    const N = allArea ? width * height : this._countSelectedPixels(matrix, width, height);
    const K = this._calculatePolynomialTerms(order);
    console.log('K = ', K);
    
    if (N <= 2 * K) {
        console.warn("Insufficient data points for polynomial fit (N <= 2*K)");
        return { coefficients: null, success: false };
    }

    // 2. Инициализация матрицы сумм (K×K) и вектора b (K элементов)
    const sums = Array(K + 1).fill(0).map(() => Array(K + 1).fill(0));// Матрица A^T A
    const b = Array(K + 1).fill(0);// Вектор A^T y

    // 3. Заполнение матрицы и вектора через метод `_buildSystemMatrix`
    this._buildSystemMatrix(matrix, width, height, order, allArea, sums, b);
    
    // 4. Решение системы линейных уравнений методом Гаусса
    const coefficients = this._solveGaussianElimination(sums, b);
    
    return { coefficients, success: true };// Возвращаем коэффициенты и флаг успеха
}

// Применение полинома к изображенияю
function _applyPolynomialCorrection(matrix, width, height, coefficients, allArea) {
    const order = Math.floor(Math.sqrt(2 * coefficients.length + 1)) - 1;
    const terms = this._getPolynomialTerms(order);
    
    //const correctedData = new Float32Array(grayData.length);
    const correctedData = new Array(height);



    // Обрабатываем все пиксели
    for (let y = 0; y < height; y++) {
        correctedData[y] = new Array(width)
        for (let x = 0; x < width; x++) {

            //const index = y * width + x;
            const value = matrix[y][x];
            
            // Пропуска точек вне выделенной области (если нужно)
            if (!allArea && !this._isPixelSelected(x, y)) {
                correctedData[y][x] = value; // Оставляем исходное значение
                //correctedData[index] = value; // Оставляем исходное значение
                continue;
            }
            
            // Вычисляем вектор A для текущей точки
            const A = this._calculatePolynomialTerms1(x, y, order);
            
            // Вычисляем значение полинома
            let val = 0;
            for (let i = 0; i < coefficients.length; i++) {
                val += coefficients[i] * A[i];
            }
            //console.log(val);
            //  console.log(coefficients);

            // Коррекция: исходное значение - фоновое значение
            //correctedData[index] = Math.max(0, Math.min(1, value - val));

            correctedData[y][x] = val;
            //correctedData[y][x] = Math.max(0, Math.min(1, value - val));
        }
    }
    
    return correctedData;
}

// Расчет количества членов полинома для заданного порядка
function _calculatePolynomialTerms(order) {
    // Формула для количества членов: (order+1)(order+2)/2 - 1
    
    return (order + 1) * (order + 2) / 2 - 1;
}

// Построение матрицы сумм и вектора b
function _buildSystemMatrix(matrix, width, height, order, allArea, sums, b) {
    const terms = this._getPolynomialTerms(order);
    const N = allArea ? width * height : this._countSelectedPixels(matrix, width, height);
    
    // Обходим все пиксели
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            //const index = y * width + x;
            const value = matrix[y][x];
            
            // Пропуска точек вне выделенной области (если нужно)
            if (!allArea && !this._isPixelSelected(x, y)) {
                continue;
            }
            
            // Вычисляем вектор A для текущей точки
            const A = this._calculatePolynomialTerms1(x, y, order);
            
            // Обновляем матрицу сумм
            for (let i = 0; i < A.length; i++) {
                for (let j = 0; j < A.length; j++) {
                    sums[i][j] += A[i] * A[j];
                }
            }
            
            // Обновляем вектор b
            for (let i = 0; i < A.length; i++) {
                b[i] += A[i] * value;
            }
        }
    }
}

// Генерация списка членов полинома для заданного порядка
function _getPolynomialTerms(order) {
    const terms = [];
    let count = 0;
    
    for (let m = 0; m <= order; m++) {
        for (let n = 0; n <= m; n++) {
            terms.push({ m: m, n: n });
            count++;
        }
    }
    
    return terms;
}

// Вычисление вектора A для конкретной точки (x, y)
function _calculatePolynomialTerms1(x, y, order) {
    const terms = this._getPolynomialTerms(order);
    const A = [1.0]; // Первый член - константа
    
    for (let i = 1; i < terms.length; i++) {
        const term = terms[i];
        const xTerm = Math.pow(x, term.m - term.n);
        const yTerm = Math.pow(y, term.n);
        A.push(xTerm * yTerm);
    }
    
    return A;
}

// Метод Гаусса для решения системы уравнений
function  _solveGaussianElimination(sums, b) {
    const K = sums.length - 1;
    const a = Array(K + 1).fill(0);
    
    // Прямой ход (элиминация)
    for (let k = 0; k < K; k++) {
        // Поиск ведущего элемента (для устойчивости)
        let maxRow = k;
        for (let i = k + 1; i < K; i++) {
            if (Math.abs(sums[i][k]) > Math.abs(sums[maxRow][k])) {
                maxRow = i;
            }
        }
        
        // Проверка на сингулярность
        if (sums[maxRow][k] === 0) {
            console.error("Singular matrix - cannot solve system");
            return null;
        }
        
        // Перестановка строк
        if (maxRow !== k) {
            for (let j = k; j <= K; j++) {
                [sums[k][j], sums[maxRow][j]] = [sums[maxRow][j], sums[k][j]];
            }
            [b[k], b[maxRow]] = [b[maxRow], b[k]];
        }
        
        // Нормализация строки
        const factor = sums[k][k];
        for (let j = k; j <= K; j++) {
            sums[k][j] /= factor;
        }
        b[k] /= factor;
        
        // Исключение переменных
        for (let i = k + 1; i < K; i++) {
            const factor = sums[i][k];
            for (let j = k; j <= K; j++) {
                sums[i][j] -= factor * sums[k][j];
            }
            b[i] -= factor * b[k];
        }
    }
    
    // Обратный ход
    for (let i = K - 1; i >= 0; i--) {
        a[i] = b[i];
        for (let j = i + 1; j < K; j++) {
            a[i] -= sums[i][j] * a[j];
        }
        a[i] /= sums[i][i];
    }
    
    return a;
}
