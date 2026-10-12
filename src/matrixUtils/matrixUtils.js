/**
 * Находит минимальное и максимальное значения в матрице файла.
 * @param {Object} file - Объект, содержащий матрицу и её размеры.
 * @returns {Object} Тот же объект file с добавленными свойствами minValue и maxValue.
 */
function findMaxMin(file) {
    // Проверка: если матрица не передана или пуста, выбрасываем ошибку.
    // Это предотвращает запись Infinity/-Infinity в свойства объекта.
    if (!file.matrix || file.height === 0 || file.width === 0) {
        throw new Error("Ошибка: Матрица пуста или некорректна.");
    }

    // Инициализация переменных для поиска экстремумов.
    // Infinity гарантирует, что первое сравнение обновит значение.
    let minVal = Infinity;
    let maxVal = -Infinity;

    // Проходим по всем строкам матрицы (ось Y)
    for (let y = 0; y < file.width; y++) {
        
        // Проходим по всем столбцам в текущей строке (ось X)
        for (let x = 0; x < file.height; x++) {
            
            // Получаем текущее значение элемента матрицы
            const val = file.matrix[y][x];

            // Проверяем, является ли текущее значение новым минимумом
            if (val < minVal) {
                minVal = val;
            }

            // Проверяем, является ли текущее значение новым максимумом
            if (val > maxVal) {
                maxVal = val;
            }
        }
    }

    // Сохраняем найденные экстремумы в объект file
    file.minValue = minVal;
    file.maxValue = maxVal;

    // Возвращаем обновленный объект
    return file;
}

/**
 * Вспомогательная функция для глубокого копирования матрицы.
 * Используем map и spread-оператор для создания новых массивов строк.
 */
const cloneMatrix = (matrix) => matrix.map(row => [...row]);






/**
 * Преобразует одномерный Float32Array в двумерный массив массивов (Array of Arrays).
 * 
 * @param {Float32Array} flat - Исходный линейный массив.
 * @param {number} rows - Количество строк.
 * @param {number} cols - Количество столбцов.
 * @returns {number[][]} Двумерный массив.
 */
 function flattenToMatrix(flat, rows, cols) {
    if (!flat || flat.length !== rows * cols) {
      throw new Error(`Длина массива (${flat ? flat.length : 0}) не соответствует размерности ${rows}x${cols}`);
    }
  
    const matrix = new Array(rows);
    for (let i = 0; i < rows; i++) {
      // Создаем новый обычный JS Array из части Float32Array
      matrix[i] = Array.from(flat.subarray(i * cols, (i + 1) * cols));
    }
    return matrix;
  }
  
  /**
   * Преобразует двумерный массив (Array of Arrays) обратно в одномерный Float32Array.
   * 
   * @param {number[][]} matrix - Исходный двумерный массив.
   * @returns {Float32Array} Линейный массив.
   */
  function matrixToFlat(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
      throw new Error("Входные данные должны быть непустым массивом массивов");
    }
  
    const rows = matrix.length;
    const cols = matrix[0].length;
    const totalElements = rows * cols;
  
    // Проверка прямоугольности матрицы и общей длины
    for (let i = 0; i < rows; i++) {
      if (!Array.isArray(matrix[i]) || matrix[i].length !== cols) {
        throw new Error(`Неравномерная ширина строк. Строка ${i} имеет длину ${matrix[i].length}, ожидалось ${cols}`);
      }
    }
  
    const flatArray = new Float32Array(totalElements);
    
    for (let i = 0; i < rows; i++) {
      // Если элементы уже являются Float32Array, используем быстрый set.
      // Если это обычные числа, set также сработает корректно, конвертируя их.
      flatArray.set(matrix[i], i * cols);
    }
  
    return flatArray;
  }
  
  // --- Пример использования ---
  
  // 1. Исходные данные (заполняем тестовыми значениями)
  const originalFlat = new Float32Array(250000);
  for (let i = 0; i < originalFlat.length; i++) {
    originalFlat[i] = i * 0.5;
  }
  
  // 2. Прямое преобразование
  const matrix = flattenToMatrix(originalFlat, 500, 500);
  console.log("Матрица создана:", matrix.length, "x", matrix[0].length);
  
  // 3. Обратное преобразование
  const restoredFlat = matrixToFlat(matrix);
  console.log("Массив восстановлен:", restoredFlat.length);
  
  // 4. Проверка идентичности
  let isIdentical = true;
  for (let i = 0; i < originalFlat.length; i++) {
    if (originalFlat[i] !== restoredFlat[i]) {
      isIdentical = false;
      break;
    }
  }
  console.log("Данные идентичны:", isIdentical);
  
