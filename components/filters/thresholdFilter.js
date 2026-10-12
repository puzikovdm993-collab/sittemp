// Открытие модального окна
function showThresholdModal() {
    const file = getActiveFile();
    if (!file) return;
    document.getElementById('thresholdModal').classList.add('active');
}

// Закрытие модального окна
function closeThresholdModal() {
    document.getElementById('thresholdModal').classList.remove('active');
}

// Применение Порог
function applyThresholdFilter() {

    const file = getActiveFile();
    if (!file) return;
    
    const thresholdMin =        parseFloat(document.getElementById("thresholdMin").value);
    const thresholdLessMin =    parseFloat(document.getElementById("thresholdLessMin").value);
    const thresholdMax =        parseFloat(document.getElementById("thresholdMax").value);
    const thresholdMoreMax =    parseFloat(document.getElementById("thresholdMoreMax").value);

    // Выполняем поэлементное деление
    for (let y = 0; y < file.height; y++) {
        for (let x = 0; x < file.width; x++) {

            if(file.matrix[y][x] > thresholdMax) {
                file.matrix[y][x] = thresholdMoreMax;
            }
            
            if(file.matrix[y][x] < thresholdMin) {
                file.matrix[y][x] = thresholdLessMin;
            }
        }
    }


    findMaxMin(file);
    matrixToImage();
    setActionName('Порог', {
        thresholdMin:       thresholdMin,
        thresholdLessMin:   thresholdLessMin,
        thresholdMax:       thresholdMax,
        thresholdMoreMax:   thresholdMoreMax
    });

    setМalueСolorbarlabel(file.minValue, file.maxValue);
    closeThresholdModal();
    saveState();
}

