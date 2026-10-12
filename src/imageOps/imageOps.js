// Операции над изображением и выделением




// #region [Поворот] (VS Code)
// ============ Поворот ============
function rotateCanvas(angle) {
    const file = getActiveFile();
    if (!file || !file.canvas) return;

    if (currentTool == 'profile' && currentProfile !=null ) {
        redrawFromHistory();
        currentProfile = null;
    }

    const restoredMatrix =  _rotateMatrix(file.matrix,file.width,file.height, angle);
    file.matrix = restoredMatrix. matrix;
    file.width= restoredMatrix.width;
    file.height  = restoredMatrix.height;

    findMaxMin(file);

    matrixToImage();

    if (file.id === activeFileId) {
        canvas = file.canvas;
        ctx = file.ctx;
        updateCanvasSize();
        applyZoom();
    }
    setActionName('Поворот', { angle: angle });
    saveState();
}

/**
 * Поворачивает матрицу данных на произвольный угол.
 * @param {number[][]} matrix - Входная матрица (массив массивов).
 * @param {number} width - Ширина матрицы.
 * @param {number} height - Высота матрицы.
 * @param {number} angleDegrees - Угол поворота в градусах.
 * @returns {Object} - Объект с повернутой матрицей и новыми размерами.
 */
function _rotateMatrix(matrix, width, height, angleDegrees) {
    // Преобразуем угол в радианы
    const angleRad = angleDegrees * Math.PI / 180;
    let sin = Math.sin(angleRad);
    let cos = Math.cos(angleRad);

    if  (angleDegrees == 360) {
        sin=0;
        cos=1;
    }
    if  (angleDegrees == 90) {
        sin=1;
        cos=0;
    }
    if  (angleDegrees == 270) {
        sin=-1;
        cos=0;
    }
    if  (angleDegrees == 180) {
        sin=0;
        cos=-1;
    }

    
    // Вычисляем новые размеры после поворота
    const newWidth = Math.round(Math.abs(width * cos) + Math.abs(height * sin));
    const newHeight = Math.round(Math.abs(width * sin) + Math.abs(height * cos));
    
    // Создаем новую матрицу для результата
    // const rotatedMatrix = Array(newHeight).fill(null).map(() => Array(newWidth).fill(0));
    
    const rotatedMatrix = Array.from({ length: Math.round(newHeight) }, () =>
        Array(Math.round(newWidth)).fill(0)
    );
    // Центры исходной и новой матрицы
    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;
    const newCenterX = (newWidth - 1) / 2;
    const newCenterY = (newHeight - 1) / 2;
    
    // Проходим по каждому пикселю новой матрицы
    for (let newY = 0; newY < newHeight; newY++) {
        for (let newX = 0; newX < newWidth; newX++) {
            // Вычисляем координаты в исходной матрице (обратное преобразование)
            const dx = newX - newCenterX;
            const dy = newY - newCenterY;
            
            // Обратный поворот
            const srcX = centerX + dx * cos + dy * sin;
            const srcY = centerY - dx * sin + dy * cos;
            
            // Билинейная интерполяция
            if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
                const x0 = Math.floor(srcX);
                const y0 = Math.floor(srcY);
                const x1 = x0 + 1;
                const y1 = y0 + 1;
                
                const wx = srcX - x0;
                const wy = srcY - y0;
                
                // Получаем значения четырех соседних пикселей
                const q11 = matrix[y0][x0];
                const q12 = matrix[y0][x1];
                const q21 = matrix[y1][x0];
                const q22 = matrix[y1][x1];
                
                // Билинейная интерполяция
                const interpolatedValue = 
                    q11 * (1 - wx) * (1 - wy) +
                    q12 * wx * (1 - wy) +
                    q21 * (1 - wx) * wy +
                    q22 * wx * wy;
                
                rotatedMatrix[newY][newX] = interpolatedValue;
            } else if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                // Граничные значения - берем ближайший пиксель
                const nearestX = Math.round(Math.max(0, Math.min(width - 1, srcX)));
                const nearestY = Math.round(Math.max(0, Math.min(height - 1, srcY)));
                rotatedMatrix[newY][newX] = matrix[nearestY][nearestX];
            } else {
                // За пределами изображения - оставляем 0 или можно задать другое значение
                rotatedMatrix[newY][newX] = 0;
            }
        }
    }
    
    return {
        matrix: rotatedMatrix,
        width: newWidth,
        height: newHeight
    };
}
// #endregion


// #region [отражение] (VS Code)
function flipCanvas(direction) {
    const file = getActiveFile();
    if (!file || !file.canvas) return;   
    if (direction === 'horizontal') {
        const restoredMatrix = flepHorizontal(file.matrix);
        file.matrix = restoredMatrix;

    } else if (direction === 'vertical') {
        const restoredMatrix = flipVertical(file.matrix);
        file.matrix = restoredMatrix;
    }

    findMaxMin(file);

    matrixToImage();

    if (file.id === activeFileId) {
        canvas = file.canvas;
        ctx = file.ctx;
        updateCanvasSize();
        applyZoom();
    }
    
    saveState();
}
/**
 * Переворачивает двумерный массив по вертикали (зеркалирует строки).
 * @param {Array<Array<*>>} arr - Исходный двумерный массив.
 * @returns {Array<Array<*>>} Новый массив с перевернутыми строками.
 */
 function flipVertical(arr) {
    // Создаём копию массива и переворачиваем порядок строк
    return arr.slice().reverse();
}

function flepHorizontal(arr) {
    return arr.map(row => row.slice().reverse());
}
// #endregion


function getColormap(name) {
    const colormaps = {
        'hot': (t) => ({
            r: t < 0.5 ? 0 : 2 * t,
            g: t < 0.25 ? 0 : t < 0.75 ? 2 * t - 0.5 : 1,
            b: t < 0.75 ? 0 : 2 * t - 1
        }),
        'jet': (t) => {
            const h = 240 * (1 - t); // От синего (t=0) до красного (t=1)
            const hslToRgb = (h) => {
                const hue = h / 360; // Нормализуем до [0, 1]
                const i = Math.floor(hue * 6); // Индекс сегмента
                const f = hue * 6 - i; // Дополнительная доля
                
                // Значения для RGB (избегаем дублирования имён)
                const red = [1, f, 1 - f, 0, 0, 0][i % 6];
                const green = [1 - f, 1, 1, 1 - f, 1 - f, 1 - f][i % 6];
                const blue = [0, 0, 0, 0, 1 - f, 1][i % 6];
                
                return { r: red, g: green, b: blue }; // Теперь ключи объекта не конфликтуют
            };
            return hslToRgb(h);
        },
        'gray': (t) => {
            // Gray: от черного к белому
            // Определяем цвета градиента
            const colors = [
              { offset: 0,    r: 0,   g: 0,   b: 0},          // Черный(начало)
              { offset: 1,    r: 255, g: 255, b: 255  }           // Белый (конец)
            ];
            const color = getGradientColor(t,colors);
            return { r: color.r, g: color.g, b: color.b};
        },
        'viridis': (t) => { // Упрощённая версия
            const x = 1 - t;
            const a = 16.0, b = 254.0;
            const red = ((6.0 - 2.4 * x) * x * x * x + (-4.8 * x * x * x + 18.0 * x * x - 22.2 * x + 8.3) * x * x * x + (b - a) * x * x * x * x * x * x + a) / 255;
            const green = ((13.0 - 1.5 * x) * x * x * x + (-12.0 * x * x * x + 45.0 * x * x - 49.5 * x + 17.0) * x * x * x + (b - a) * x * x * x * x * x * x + a) / 255;
            const blue = ((b - a) * x * x * x * x * x * x + a) / 255;
            return { r: red, g: green, b: blue }; // Ключи объекта не конфликтуют
        },
        // Новые RGB палитры
        'plasma': (t) => {
            // Plasma: от синего через фиолетовый к желтому
            // Определяем цвета градиента
            const colors = [
              { offset: 0,    r: 0,   g: 0,   b: 255},          // Синий(начало)
              { offset: 0.5,  r: 128, g: 0,   b: 128 },         // Фиолетовый (середина)
              { offset: 1,    r: 255, g: 255, b: 0  }           // Жёлтый (конец)
            ];
            const color = getGradientColor(t,colors);
            return { r: color.r, g: color.g, b: color.b};
        },
        'inferno': (t) => {
            // Inferno: от черного через красный к желтому
            // Определяем цвета градиента
            const colors = [
                { offset: 0,    r: 0,   g: 0,   b: 0 },          // Черный (начало)
                { offset: 0.5,  r: 255, g: 0,   b: 0 },         // Красный (середина)
                { offset: 1,    r: 255, g: 255, b: 0 }           // Жёлтый (конец)
              ];
              const color = getGradientColor(t,colors);
              return { r: color.r, g: color.g, b: color.b};
        },
        'magma': (t) => {
            // Magma: от черного через розовый к белому
            // Определяем цвета градиента
            const colors = [
                { offset: 0,    r: 0,   g: 0,   b: 0 },         // Черный (начало)
                { offset: 0.5,  r: 238, g: 130,   b: 238 },     // Розовый (середина) 
                { offset: 1,    r: 255, g: 255, b: 255 }        // Белый (конец)
              ];
              const color = getGradientColor(t,colors);
              return { r: color.r, g: color.g, b: color.b};
        },
        'cividis': (t) => {
            // Cividis: оптимизирована для дальтоников
            const colors = [
                { offset: 0,    r: 0,   g: 104,     b: 157 },         // голубого  (начало)
                { offset: 0.33, r: 0,   g: 161,     b: 148 },           // зелёный  (середина) 
                { offset: 0.66, r: 195, g: 233,     b: 129 },         // жёлтый  (середина) 
                { offset: 1,    r: 234, g: 169,     b: 66 }             // коричневым  (конец)
            ];
            const color = getGradientColor(t,colors);
            return { r: color.r, g: color.g, b: color.b};
        },
        'rainbow': (t) => {
            // Rainbow
            const colors = [
                { offset: 0,    r: 255, g: 0,   b: 0    },          // Красный  (начало)
                { offset: 0.25, r: 255, g: 165, b: 0    },          // Ораньжевый  (середина) 
                { offset: 0.5,  r: 255, g: 255, b: 0    },          // Желтый  (середина) 
                { offset: 0.75, r: 0,   g: 128, b: 0    },          // Зеленый  (середина)
                { offset: 1,    r: 0,   g: 0,   b: 255  }           // Синий  (конец) 

            ];
            const color = getGradientColor(t,colors);
            return { r: color.r, g: color.g, b: color.b};
        },
        'coolwarm': (t) => {
            // Coolwarm: от синего через белый к красному
            const colors = [
                { offset: 0,    r: 0, g: 0,   b: 255    },          // Синий  (начало) 
                { offset: 0.5,  r: 0, g: 0, b: 0    },          // Белый  (середина) 
                { offset: 1,    r: 255,   g: 0,   b: 0  }           // Красный  (конец) 

            ];
            const color = getGradientColor(t,colors);
            return { r: color.r, g: color.g, b: color.b};
        }
    };

    if (!colormaps[name]) {
        console.warn(`Цветовая карта "${name}" не найдена. Используется "gray".`);
        return colormaps['gray'];
    }
    return colormaps[name];
}

function replaceColormap(file, newColormap){
    console.log('replaceColormap');

    const colorMap = getColormap(newColormap);
    const data = new Uint8ClampedArray(file.width * file.height * 4);
    let dataIndex = 0;
    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {
            const normalizedValue = (file.matrix[y][x] - file.minValue) / (file.maxValue - file.minValue + 1e-9);
            
            const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
            // data[dataIndex++] = color.r * 255;
            // data[dataIndex++] = color.g * 255;
            // data[dataIndex++] = color.b * 255;
            data[dataIndex++] = color.r;
            data[dataIndex++] = color.g;
            data[dataIndex++] = color.b;
            data[dataIndex++] = 255;
        }
    }
    const imageData = new ImageData(data, file.width, file.height);
    file.ctx.putImageData(imageData, 0, 0);
    // file.colormap = newColormap;
    // pushState(file);
    // return file;
}

/**
 * Возвращает RGB-цвет из заданного градиента по значению t ∈ [0, 1].
 * @param {number} t - Позиция в градиенте (0 = начало, 1 = конец)
 * @returns {string} RGB-строка, например "rgb(255, 128, 0)"
 */
 function getGradientColor(t,colors) {
    // Проверка диапазона t
    t = Math.max(0, Math.min(1, t));
  
    // // Определяем цвета градиента
    // const colors = [
    //   { offset: 0,    r: 255, g: 255, b: 0 },   // Жёлтый (начало)
    //   { offset: 0.5,  r: 128, g: 0,   b: 128 }, // Фиолетовый (середина)
    //   { offset: 1,    r: 0,   g: 0,   b: 255 }   // Синий (конец)
    // ];
  
    // Находим два соседних цвета, между которыми находится t
    for (let i = 0; i < colors.length - 1; i++) {
      const startColor = colors[i];
      const endColor = colors[i + 1];
  
      if (t >= startColor.offset && t <= endColor.offset) {
        const segmentLength = endColor.offset - startColor.offset;
        const segmentPosition = (t - startColor.offset) / segmentLength;
  
        // Интерполяция между цветами
        const r = Math.round(
          startColor.r + segmentPosition * (endColor.r - startColor.r)
        );
        const g = Math.round(
          startColor.g + segmentPosition * (endColor.g - startColor.g)
        );
        const b = Math.round(
          startColor.b + segmentPosition * (endColor.b - startColor.b)
        );
  
        //return `rgb(${r}, ${g}, ${b})`;
        return { 
            r: r, 
            g: g, 
            b: b
        };
      }
    }
  
    // Если t вне диапазона (по умолчанию возвращаем первый цвет)
    ///return `rgb(${colors[0].r}, ${colors[0].g}, ${colors[0].b})`;
    return { 
        r: colors[0].r, 
        g: colors[0].g, 
        b: colors[0].b 
    };
  }


function imageToMatrix(imageData, width, height, minVal, maxVal, autoscale = true) {
    const data = imageData.data; // Uint8ClampedArray (RGBA)
    const matrix = new Array(height);

    for (let y = 0; y < height; y++) {
        matrix[y] = new Array(width);
        for (let x = 0; x < width; x++) {
            // Индекс пикселя в ImageData: 4 * (y * width + x)
            const dataIndex = 4 * (y * width + x);
            const r = data[dataIndex] / 255;     // Нормализованное значение (0..1)
            const g = data[dataIndex + 1] / 255;
            const b = data[dataIndex + 2] / 255;

            // Для градаций серого используем среднее (или любой канал, например r)
            const normalizedValue = (r + g + b) / 3; // или просто r (если изображение чёрно-белое)

            // Обратное преобразование в исходные значения
            const matrixValue = autoscale 
                ? minVal + normalizedValue * (maxVal - minVal) 
                : scale[0] + normalizedValue * (scale[1] - scale[0]);

            matrix[y][x] = matrixValue;
        }
    }

    return matrix;
}




// #region [Медианный фильтр]


// Применение медианного фильтра
async function applyMedianFilter() {

    const file = getActiveFile();
    if (!file) return;

    const t = document.getElementById('newAperture').value;
    closeMedianModal();
    
    showProgressModal('Медианный фильтр', true);

    setTimeout(async () => {

        updateProgress(10, 'Инициализация...');
        await new Promise(resolve => setTimeout(resolve, 50));

        updateProgress(20, 'Вычисление фильтра...');

        const aprture = parseInt(t, 10);

        const fullFilteredMatrix  = await _medianFilter(file.matrix, aprture); 

        let resultMatrix;
        if (collectionSelection.pixels.length > 0) {
            resultMatrix = cloneMatrix(file.matrix);
            for (const [x, y] of collectionSelection.pixels) {
                resultMatrix[y][x] = fullFilteredMatrix[y][x];
            }
        }
        else {
            resultMatrix = cloneMatrix(fullFilteredMatrix);
        }
        


        updateProgress(90, 'Применение цветовой карты...');
        await new Promise(resolve => setTimeout(resolve, 10));
        file.matrix = resultMatrix;
        matrixToImage();

        
        // Находим минимальное и максимальное значения в матрице:
        updateProgress(82, 'Поиск мин/макс значений...');
        await new Promise(resolve => setTimeout(resolve, 10));
        findMaxMin(file);

        updateProgress(98, 'Применение изменений...');
        await new Promise(resolve => setTimeout(resolve, 10));

        setМalueСolorbarlabel(file.minValue, file.maxValue);

        updateProgress(100, 'Готово!');
        setActionName('Медианный фильтр', { aperture: aprture });
        saveState();

        setTimeout(() => { closeProgressModal(); }, 300);
    }, 50);
}


/**
 * Применяет медианный фильтр к матрице m × n.
 * @param {number[][]} matrix - Входная матрица (массив массивов).
 * @param {number} kernelSize - Размер окна фильтра (нечетное число, например 3).
 * @returns {Promise<number[][]>} - Отфильтрованная матрица.
 */
async function _medianFilter(matrix, kernelSize) {
    const m = matrix.length;
    const n = matrix[0].length;
    const padSize = Math.floor(kernelSize / 2);
    
    updateProgress(30, 'Создание расширенной матрицы...');
    await new Promise(resolve => setTimeout(resolve, 50)); // Пауза для отрисовки
    
    const paddedMatrix = this._createPaddedMatrix(matrix, padSize);
    const filteredMatrix = [];

    const totalPixels = m * n;
    let processedPixels = 0;
    const updateInterval = Math.max(1, Math.floor(totalPixels / 100)); // Обновляем каждые 1%

    // Основной цикл фильтрации с разбивкой на чанки для плавного обновления UI
    for (let i = 0; i < m; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
            // Извлекаем подматрицу (окрестность) размера kernelSize × kernelSize
            const window = this._extractWindow(paddedMatrix, i + padSize, j + padSize, kernelSize);
            // Находим медиану
            const median = this._calculateMedian(window);
            row.push(median);
            
            processedPixels++;
            
            // Обновляем прогресс каждые 1% или в конце
            if (processedPixels % updateInterval === 0 || processedPixels === totalPixels) {
                // Более точный расчет прогресса: 
                // 30% уже пройдено (подготовка), осталось 50% на фильтрацию (с 30% до 80%)
                const filterProgress = 30 + Math.round((processedPixels / totalPixels) * 50);
                const rowsCompleted = i + 1;
                const percentComplete = ((processedPixels / totalPixels) * 100).toFixed(1);
                updateProgress(filterProgress, `Фильтрация: ${rowsCompleted} из ${m} строк (${percentComplete}%)`);
                // Небольшая пауза для отрисовки прогресс-бара, но не слишком частая
                if (processedPixels % (updateInterval * 5) === 0 || processedPixels === totalPixels) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        }
        filteredMatrix.push(row);
    }

    return filteredMatrix;
}

/**
* Создает расширенную матрицу с нулевыми границами для обработки краев.
*/
function _createPaddedMatrix(matrix, padSize) {
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
* Извлекает подматрицу (окрестность) вокруг точки (x, y).
*/
function _extractWindow(matrix, x, y, size) {
    const half = Math.floor(size / 2);
    const window = [];
    for (let i = x - half; i <= x + half; i++) {
        for (let j = y - half; j <= y + half; j++) {
            window.push(matrix[i][j]);
        }
    }
    return window;
}

/**
* Вычисляет медиану массива чисел.
*/
function _calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 
        ? sorted[mid] 
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

// #endregion




// #region [Нормализация]
// Применение Нормализация фильтра
function applyNormalisatioFilter() {
    const file = getActiveFile();
    if (!file) return;

    const min_norm = parseInt(document.getElementById("normalizBegin").value, 10);
    const max_norm = parseInt(document.getElementById("normalizEnd").value, 10);

    session.normbegin = min_norm;
    session.normend = max_norm;

    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {
            const normalizedValue = (file.matrix[y][x] - file.minValue) / (file.maxValue - file.minValue) * (max_norm - min_norm) + min_norm;
            file.matrix[y][x] = normalizedValue;
        }
    }

    file.minValue = min_norm;
    file.maxValue = max_norm;

    matrixToImage();
    setActionName('Нормализация', { min_norm: min_norm, max_norm: max_norm });
    setМalueСolorbarlabel(file.minValue, file.maxValue);
    saveState();
    closeNormalisatioModal();
}
// ==========================================
// #endregion


// #region [Собель фильтр]
// Применение Собель фильтр
function applySobelFilter() {

    const file = getActiveFile();
    if (!file) return;
    
    const result = { data: new Array(file.height).fill(0).map(() => new Array(file.width).fill(0)) };

    // Ядра Собеля для вычисления градиентов
    const sobelKernels = {
        // Горизонтальный градиент
        gx: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], 
        // Вертикальный градиент
        gy: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]   
    };
    
    
    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {
            let gxSum = 0, gySum = 0;
            // Применяем свёртку (3x3 окно)
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const px = x + kx;
                    const py = y + ky;

                    // Проверка границ
                    if (px >= 0 && px < file.width && py >= 0 && py < file.height) {
                        // Вклад в градиенты
                        gxSum += file.matrix[py][px] * sobelKernels.gx[ky + 1][kx + 1];
                        gySum += file.matrix[py][px] * sobelKernels.gy[ky + 1][kx + 1];
                    }
                }
            }
            result.data[y][x] = Math.sqrt(gxSum * gxSum + gySum * gySum);
            if(x == file.width - 1 || y == file.height - 1 || x == 0 || y == 0){
                result.data[y][x] = 0; 
            }
            
        }
    }

    file.matrix = result.data;
    findMaxMin(file);
    setМalueСolorbarlabel(file.minValue, file.maxValue);
    matrixToImage();
    setActionName('Фильтр Собель', {});
    saveState();
}
// #endregion


// #region [Апроксимация] (VS Code)
// ============ Апроксимация ============

// Применение апроксимации
function applyApproximationFilter() {

    const file = getActiveFile();
    if (!file) return;

    // // // Вычисляем коэффициенты полиномиальной модели фона методом наименьших квадратов
    // // const { coefficients, success } = _computePolynomialCoefficients(
    // //     file.matrix, file.width, file.height, 
    // //     session.node_orderApproximation, 
    // //     true
    // // );

    // // // Применяем коррекцию
    // // const result123 = _applyPolynomialCorrection(
    // //     file.matrix, file.width, file.height, 
    // //     coefficients, 
    // //     true
    // // );

    const applyToAllCheckbox = document.getElementById("apply-to-all");

    const config = {
        order: session.node_orderApproximation,
        allArea: applyToAllCheckbox.checked,
        roisPixels: collectionSelection.pixels
    };
    const result = applyBackgroundCorrection(file.matrix, file.width, file.height, config)



    file.matrix = result;
    findMaxMin(file);
    matrixToImage();
    setActionName('Апроксимация', { node_orderApproximation:session.node_orderApproximation});
    setМalueСolorbarlabel(file.minValue, file.maxValue);
    closeApproximationModal();
    saveState();
}

// #endregion



// #region [Логарифмирование] (VS Code)
// ============ Логарифмирование ============
function showLogorifmModal() {
}
// Закрытие Логарифмирование окна
function closeLogorifmModal() {

}

// Применение Логарифмирование фильтра
function applyLogorifmFilter() {

    const file = getActiveFile();
    if (!file) return;

    const result = { data: new Array(file.height).fill(0).map(() => new Array(file.width).fill(0)) };

    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {
            const a = file.matrix[y][x] ?? 0;
            const ln_matrix = Math.log(a);                            
            result.data[y][x] = ln_matrix;
        }
    }

    file.matrix = result.data;
    findMaxMin(file);
    setМalueСolorbarlabel(file.minValue, file.maxValue);
    matrixToImage();
    setActionName('Логарифмирование', {});
    saveState();
}
// #endregion


// #region [Поиск окружности] (VS Code)
// ============ Поиск окружности ============

// Применение "Поиск окружности" фильтра
function applyRoundSearchingFilter() {

    const file = getActiveFile();
    if (!file) return;
    closeRoundSearchingModal();
    // Получаем выбранный элемент радиокнопки
    const selectedShape = document.querySelector('input[name="shape"]:checked');
    // Проверяем, есть ли выбранный вариант
    if (selectedShape) {
        const shapeValue = selectedShape.value; // "circle" или "ellipse"
        console.log("Выбрана фигура:", shapeValue);
    } else {
        console.log("Фигура не выбрана");
    }


    // 2. Поиск параметров


    const boundaryX = [];
    const boundaryY = [];
    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {

            
            if(file.matrix[y][x] == 1) {
                boundaryX.push(x);
                boundaryY.push(y);
            }
        }
    }
    const res =  circleSearch(boundaryX.length,boundaryX,boundaryY);
    console.log(res);


    // Определяем соответствующие спаны
    const centerX = document.getElementById('centerX');
    const centerY = document.getElementById('centerY');
    const radius = document.getElementById('radius');

    centerX.textContent = res.center[0].toFixed(2);
    centerY.textContent = res.center[1].toFixed(2);
    radius.textContent = res.radius.toFixed(2);
    showResultRoundSearchingModal();

    // if (file.id === activeFileId) {
    //     canvas = file.canvas;
    //     ctx = file.ctx;
    //     applyZoom();
    //     updateCanvasSize();
    // }

    // saveState();
}

/**
 * Поиск центров окружности методом наименьших квадратов (5 итераций)
 * @param {number} count_points - Количество точек
 * @param {Float32Array} X - Массив X-координат точек
 * @param {Float32Array} Y - Массив Y-координат точек
 * @param {number} [num_iter=5] - Количество итераций (по умолчанию 5)
 */
 function circleSearch(count_points, X, Y, num_iter = 5) {
    // Начальное приближение (центр масс точек)
    let x_center = 0.0;
    let y_center = 0.0;
    let Radius  = 0.0;    // Сумма квадратов расстояний от начального центра
    for (let i = 0; i < count_points; i++) {
        x_center += X[i];
        y_center += Y[i];
    }
    x_center /= count_points;
    y_center /= count_points;
   
    // Итеративное уточнение центра и радиуса
    for (let ni = 0; ni < num_iter; ni++) {
        let RR = 0.0;    // Сумма квадратов расстояний от начального центра
        let X1 = 0.0;
        let Y1 = 0.0;
        let dX_dx = 0.0;
        let dX_dy = 0.0;
        let dY_dx = 0.0;
        let dY_dy = 0.0;

        // Вычисляем среднее значение RR (квадрат радиуса)
        for (let i = 0; i < count_points; i++) {
            const dx = X[i] - x_center;
            const dy = Y[i] - y_center;
            RR += dx * dx + dy * dy;
        }
        RR /= count_points;

        // Вычисляем суммы для поправок X1 и Y1
        for (let i = 0; i < count_points; i++) {
            const dx = X[i] - x_center;
            const dy = Y[i] - y_center;
            const term = (dx * dx + dy * dy - RR);
            
            X1 += term * X[i];
            Y1 += term * Y[i];
        }

        // Матрица производных (dX_dx, dX_dy, dY_dx, dY_dy)
        let xx = 0.0, xy = 0.0, yx = 0.0, yy = 0.0;
        
        for (let i = 0; i < count_points; i++) {
            xx = xy = yx = yy = 0.0;

            for (let j = 0; j < count_points; j++) {
                xx += X[j] - X[i];
                yy += Y[j] - Y[i];
            }
            
            xy = yy;  // Симметрия матрицы (dX_dy = dY_dx)
            yx = xx;

            // Нормализация (деление на количество точек)
            xx *= X[i] / count_points;
            xy *= X[i] / count_points;
            yx *= Y[i] / count_points;
            yy *= Y[i] / count_points;

            // Накопление сумм для матрицы Гессе
            dX_dx += xx;
            dX_dy += xy;
            dY_dx += yx;
            dY_dy += yy;
        }

        // Удвоение производных (как в C#)
        dX_dx *= 2.0;
        dX_dy *= 2.0;
        dY_dx *= 2.0;
        dY_dy *= 2.0;

        // Вычисление поправок
        const D1 = dX_dx * x_center + dX_dy * y_center - X1;
        const D2 = dY_dx * x_center + dY_dy * y_center - Y1;

        // Решение системы уравнений методом Крамера
        let x_new, y_new;
        
        // Избегаем деления на ноль
        if (dX_dx === 0) {
            // Вырожденный случай - можно добавить обработку по необходимости
            y_new = (D2 / dY_dy) || 0;
            x_new = (D1 - dX_dy * y_new) / (dX_dx + 0.0001); // Добавляем epsilon
        } else {
            y_new = (D2 - D1 * dY_dx / dX_dx) / (dY_dy - dX_dy * dY_dx / dX_dx);
            x_new = (D1 - dX_dy * y_new) / dX_dx;
        }

        // Обновляем центр окружности
        x_center = x_new;
        y_center = y_new;

            // Вычисляем итоговый радиус
    //const RR = 0.0; // На последней итерации RR уже содержит среднее значение
    Radius = Math.sqrt(RR);
    }



    return { center: [x_center, y_center], radius: Radius };
}

function findCircle(boundaryPoints) {
    let { centerX, centerY } = getInitialGuess(boundaryPoints);
    let radius = 0;
    const numPoints = boundaryPoints.length;
    const numIterations = 1;
    console.log('centerX = ' + centerX);
    console.log('centerY = ' + centerY);

    for (let iter = 0; iter < numIterations; iter++) {
        let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, sumYY = 0;
        
        for (const [x, y] of boundaryPoints) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distSq = dx * dx + dy * dy;
            
            sumX += dx * (distSq - radius);
            sumY += dy * (distSq - radius);
            sumXX += distSq * dx;
            sumXY += distSq * dy;
            sumYY += dy * dy * dx;
        }

        console.log('sumXX = ' + sumXX);
        console.log('sumXY = ' + sumXY);
        console.log('sumXY = ' + sumXY);
        console.log('sumXY = ' + sumXY);
        console.log('numPoints = ' + numPoints);
      

        const denominator = numPoints * (sumXX * sumXY - sumXY * sumXY);
        console.log(denominator);
        const newCenterX = (sumXX * centerY - sumXY * centerX) / denominator;
        const newCenterY = (sumXY * centerX - sumYY * centerY) / denominator;
        const newRadius = (sumXX * (newCenterX - centerX) + sumXY * (newCenterY - centerY)) / numPoints;


        console.log('sumXX * sumXY - sumXY * sumXY = ' + (sumXX * sumXY - sumXY * sumXY));

        console.log('newCenterX = ' + newCenterX);
        console.log('newCenterY = ' + newCenterY);
        

        centerX = newCenterX;
        centerY = newCenterY;
        radius = newRadius;
    }

    return {
        centerX: Math.round(centerX * 100) / 100,
        centerY: Math.round(centerY * 100) / 100,
        radius: Math.round(radius * 100) / 100
    };
}

function getInitialGuess(points) {
    let sumX = 0, sumY = 0;
    for (const [x, y] of points) {
        sumX += x;
        sumY += y;
    }
    return {
        centerX: sumX / points.length,
        centerY: sumY / points.length
    };
}

function _detectBoundary(imageData, width, height, maxValue) {
    const boundary = [];
    const data = imageData.data;
    const stride = imageData.width * 4; // RGBA
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const offset = y * stride + x * 4;
            
            // Проверяем, является ли текущий пиксель частью границы
            const centerValue = data[offset];
            if (centerValue === maxValue) {
                let isBoundary = false;
                const indices = [
                    // 3x3 neighborhood (top-left to bottom-right)
                    (y-1)*stride + (x-1)*4, // NW
                    (y-1)*stride + x*4,     // N
                    (y-1)*stride + (x+1)*4, // NE
                    y*stride + (x-1)*4,     // W
                    offset,                   // C
                    y*stride + (x+1)*4,     // E
                    (y+1)*stride + (x-1)*4, // SW
                    (y+1)*stride + x*4,     // S
                    (y+1)*stride + (x+1)*4  // SE
                ];

                const values = indices.map(i => data[i]);
                if (values.some(v => v === 0)) {
                    boundary.push([x, y]);
                    data[offset] = 0; // Помечаем как границу (может потребоваться сохранение оригинала)
                }
            }
        }
    }

    return boundary;
}
// #endregion














// // Цветовые коррекции
// function invertColors()
// function grayscale()

// // Обрезка (crop)
// function cropImage(x, y, w, h)                // вызывается из обработчика

// // Буфер обмена (заглушки)
// function copySelection()
// function pasteFromClipboard()
// function cutSelection()

// // Действия с выделением лассо
// function lassoDelete()
// function lassoFill()
// function lassoFeather()
