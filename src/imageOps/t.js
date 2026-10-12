


/**
 * Реализация алгоритма полиномиальной коррекции фона.
 * Алгоритм строит аппроксимирующую поверхность (поверхность наименьших квадратов)
 * по точкам в выбранных областях (ROI) и использует её для вычисления значений фона.
 */

/**
 * Вычисляет общее количество коэффициентов K для двумерного многочлена заданного порядка.
 * Количество членов в многочлене 2-х переменных растет прогрессивно.
 * 
 * @param {number} order - Порядок многочлена (степень)
 * @returns {number} Количество коэффициентов
 */
 function calculateK(order) {
    // let k = 0;
    // // Суммируем количество слагаемых для каждой степени от 0 до order
    // for (let l = 0; l < order + 1; l++) {
    //     k += (l + 2);
    // }
    // return k;
    return (order + 1) * (order + 2) / 2 - 1;
}

/**
 * Генерирует вектор базисных функций (мономов) для конкретной точки (x, y).
 * Пример для order=1: [1, x, y]
 * Пример для order=2: [1, x, y, x^2, xy, y^2]
 * 
 * @param {number} x - Координата X
 * @param {number} y - Координата Y
 * @param {number} order - Порядок многочлена
 * @param {number} K - Общее количество коэффициентов (для размера массива)
 * @returns {Float64Array} Вектор значений базисных функций
 */
function getPolynomialTerms(x, y, order, K) {
    const A = new Float64Array(K + 1);
    A[0] = 1.0; // Свободный член (константа)
    
    let pos = 1;
    for (let l = 0; l < order + 1; l++) {
        const numElementsInLine = l + 2;
        for (let li = 0; li < numElementsInLine; li++) {
            // Вычисление члена x^(n-i) * y^i
            A[pos] = Math.pow(x, numElementsInLine - li - 1) * Math.pow(y, li);
            pos++;
        }
    }
    return A;
}

/**
 * Решает систему линейных алгебраических уравнений (СЛАУ) методом Гаусса.
 * 
 * @param {Float64Array[]} sums - Матрица коэффициентов (левая часть системы)
 * @param {Float64Array} b - Вектор свободных членов (правая часть системы)
 * @returns {Float64Array|null} Вектор искомых коэффициентов a или null, если решение не найдено
 */
function solveLinearSystem(sums, b) {
    const size = b.length;
    const a = new Float64Array(size);
    
    // Создаем глубокие копии, чтобы не изменять исходные данные при вычислениях
    const s = sums.map(row => new Float64Array(row));
    const v = new Float64Array(b);

    // --- ЭТАП 1: Диагонализация (Pivot) ---
    // Проверяем главную диагональ. Если на ней 0, ищем строку ниже, где в этом столбце не 0, 
    // и меняем их местами. Это необходимо для корректного деления.
    for (let i = 0; i < size; i++) {
        if (s[i][i] === 0) {
            for (let j = 0; j < size; j++) {
                if (j !== i && s[j][i] !== 0 && s[i][j] !== 0) {
                    [s[i], s[j]] = [s[j], s[i]]; // Меняем строки в матрице
                    [v[i], v[j]] = [v[j], v[i]]; // Меняем соответствующие элементы вектора b
                    break;
                }
            }
        }
    }

    // --- ЭТАП 2: Прямой ход (Исключение Гаусса) ---
    // Приводим матрицу к верхнетреугольному виду
    for (let k = 0; k < size; k++) {
        for (let i = k + 1; i < size; i++) {
            if (s[k][k] === 0) return null; // Определитель равен 0, система не имеет единственного решения
            
            const m = s[i][k] / s[k][k]; // Коэффициент исключения
            for (let j = k; j < size; j++) {
                s[i][j] -= m * s[k][j];
            }
            v[i] -= m * v[k];
        }
    }

    // --- ЭТАП 3: Обратный ход ---
    // Находим значения переменных, начиная с последней
    for (let i = size - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < size; j++) {
            sum += s[i][j] * a[j];
        }
        a[i] = (v[i] - sum) / s[i][i];
    }

    return a;
}

/**
 * Главная функция для коррекции фона изображения.
 * 
 * @param {Float32Array} srcData - Плоский массив данных изображения (интенсивности пикселей)
 * @param {number} width - Ширина изображения в пикселях
 * @param {number} height - Высота изображения в пикселях
 * @param {Object} options - Настройки:
 *        { number } order - Порядок полинома
 *        { boolean } allArea - Применять ли результат ко всему кадру или только к ROI
 *        { Array } rois - Список областей для обучения ( [{top, bottom, left, right}, ...] )
 * @returns {Float32Array} Массив с вычисленным фоном
 */
function applyBackgroundCorrection(matrix, width, height, options) {

    // 1. Создаем целевой одномерный массив
    const srcData = new Float32Array(width * height);
    // 2. Заполняем данные
    let index = 0;
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            srcData[index++] = matrix[i][j];
        }
    }
        


    const { order, allArea, roisPixels } = options;
    const K = calculateK(order);
    
    // Матрица нормальных уравнений (S) и вектор правых частей (b)
    // В методе наименьших квадратов S = A^T * A, b = A^T * Z
    const sums = Array.from({ length: K + 1 }, () => new Float64Array(K + 1));
    const b = new Float64Array(K + 1);
    let N = 0; // Счетчик использованных точек



    // 1. Накопление данных из областей ROI
    // Мы проходим по всем точкам в ROI и суммируем их вклад в систему уравнений
    // for (const rect of rois) {
    //     for (let y = rect.top; y < rect.bottom; y++) {
    //         for (let x = rect.left; x < rect.right; x++) {
    //             N++;
    //             // Получаем вектор базисных функций для текущей точки (x, y)
    //             const A = getPolynomialTerms(x, y, order, K);
    //             // Наполнение матрицы sums (произведение вектора A на самого себя)
    //             for (let i = 0; i < K + 1; i++) {
    //                 for (let j = 0; j < K + 1; j++) {
    //                     sums[i][j] += A[j] * A[i];
    //                 }
    //                 // Наполнение вектора b (произведение базиса на значение пикселя)
    //                 b[i] += A[i] * srcData[y * width + x];
    //             }
    //         }
    //     }
    // }

    if (roisPixels.length>0){
        for (const pixel of roisPixels) {
            N++;
            // Получаем вектор базисных функций для текущей точки (x, y)
            const A = getPolynomialTerms(pixel[0], pixel[1], order, K);

            // Наполнение матрицы sums (произведение вектора A на самого себя)
            for (let i = 0; i < K + 1; i++) {
                for (let j = 0; j < K + 1; j++) {
                    sums[i][j] += A[j] * A[i];
                }
                // Наполнение вектора b (произведение базиса на значение пикселя)
                b[i] += A[i] * srcData[pixel[1] * width + pixel[0]];
            }
        }
    }
    else  {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                N++;
                
                // Получаем вектор базисных функций для текущей точки (x, y)
                const A = getPolynomialTerms(x, y, order, K);
                
                // Наполнение матрицы sums (произведение вектора A на самого себя)
                for (let i = 0; i < K + 1; i++) {
                    for (let j = 0; j < K + 1; j++) {
                        sums[i][j] += A[j] * A[i];
                    }
                    // Наполнение вектора b (произведение базиса на значение пикселя)
                    b[i] += A[i] * srcData[y * width + x];
                }
            }
        }
    }


    // Проверка: точек должно быть больше, чем неизвестных коэффициентов
    if (N <= 2 * K) {
        console.warn("Недостаточно точек в ROI для построения поверхности. Требуется N > 2*K.");
        return new Float32Array(srcData.length);
    }

    // 2. Решение системы уравнений для поиска коэффициентов многочлена a
    const a = solveLinearSystem(sums, b);
    if (!a) {
        console.error("Система уравнений вырождена и не имеет решения.");
        return new Float32Array(srcData.length);
    }

    // 3. Вычисление итогового фона
    const dstData = new Float32Array(srcData.length);
    dstData.set(srcData);
    // Вспомогательная функция для вычисления значения многочлена в точке (x, y)
    // f(x, y) = a0*1 + a1*x + a2*y + a3*x^2 ...
    const applyPoint = (x, y) => {
        const A = getPolynomialTerms(x, y, order, K);
        let val = 0;
        for (let i = 0; i < K + 1; i++) {
            val += a[i] * A[i];
        }
        return val;
    };

    if (allArea) {
        // Заполняем всё изображение вычисленным фоном
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                dstData[y * width + x] = applyPoint(x, y);
            }
        }
    } else {
        // Заполняем только те области, которые были указаны в ROI
        // for (const rect of rois) {
        //     for (let y = rect.top; y < rect.bottom; y++) {
        //         for (let x = rect.left; x < rect.right; x++) {
        //             dstData[y * width + x] = applyPoint(x, y);
        //         }
        //     }
        // }
        for (const pixel of roisPixels) {
            dstData[pixel[1] * width + pixel[0]] = applyPoint(pixel[0], pixel[1]);
        }
    }

    
    // 4. Преобразование в Array of Arrays
    const result = new Array(width);
    for (let i = 0; i < width; i++) {
        // subarray создает view, Array.from копирует данные в обычный JS Array
        result[i] = Array.from(dstData.subarray(i * height, (i + 1) * height));
    }
    //console.log("Результат вычислен. Размер массива:", result1);

    return result;
}


// ## Пример использования

// ```javascript

// const width = 512;
// const height = 512;
// const imageBuffer = new Float32Array(width * height).fill(0).map(() => Math.random());

// const config = {
//     order: 2,
//     allArea: true,
//     rois: [
//         { top: 0, bottom: 10, left: 0, right: 10 },
//         { top: 500, bottom: 512, left: 500, right: 512 }
//     ]
// };

// const result = applyBackgroundCorrection(imageBuffer, width, height, config);
// console.log("Результат вычислен. Размер массива:", result.length);

// 
//  Что изменилось по сравнению с версией с классом:
// 1.  **Отсутствие состояния**: Теперь нет `this`. Все данные передаются явно. Это исключает ошибки, связанные с тем, что в объекте остались данные от предыдущего вызова (например, старые значения `sums` или `b`).
// 2.  **Инкапсуляция**: Логика решения системы `solveLinearSystem` теперь полностью отделена от логики обработки изображения. Её можно протестировать независимо.
// 3.  **Чистота данных**: Внутри `solveLinearSystem` создаются копии матриц (`s` и `v`), чтобы исходные накопленные суммы не изменялись в процессе исключения Гаусса.
// 4.  **Упрощение**: Код стал более линейным и читаемым, что соответствует стилю современной разработки на JS/TS.
