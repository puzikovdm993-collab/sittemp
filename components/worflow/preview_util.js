// Общий конструктор превью (ImageData) для workflow-узлов на основе матрицы.
// Принимает выходной объект узла с полями: width, height, data (2D-матрица),
// minValue, maxValue, colormap. Возвращает ImageData.

function buildMatrixPreview(outputData) {
    const colorMap = getColormap(outputData.colormap);
    const data = new Uint8ClampedArray(outputData.width * outputData.height * 4);
    let i = 0;

    for (let y = 0; y < outputData.height; y++) {
        for (let x = 0; x < outputData.width; x++) {
            const normalizedValue = (outputData.data[y][x] - outputData.minValue) / (outputData.maxValue - outputData.minValue + 1e-9);
            const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
            data[i++] = color.r * 255;
            data[i++] = color.g * 255;
            data[i++] = color.b * 255;
            data[i++] = 255;
        }
    }

    return new ImageData(data, outputData.width, outputData.height);
}

