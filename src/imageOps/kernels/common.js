// Общие чистые утилиты для ядер обработки матриц.
// Чистые функции без DOM и LiteGraph: параметры передаются явно.

(function () {
    const K = window.ImageOpsKernels;

    /**
     * Создаёт маску (Uint8Array) по списку точек.
     * @param {number} width - Ширина.
     * @param {number} height - Высота.
     * @param {Array<[number,number]>} points - Точки [x, y].
     * @returns {Uint8Array}
     */
    function maskFromPoints(width, height, points) {
        const mask = new Uint8Array(width * height);

        for (let i = 0; i < points.length; i++) {
            const x = points[i][0];
            const y = points[i][1];

            if (x < 0 || x >= width || y < 0 || y >= height) {
                continue;
            }

            mask[y * width + x] = 1;
        }

        return mask;
    }


    function isValidMatrix(nodeData) {
        if (!nodeData) {
            return false;
        }

        if (
            !Number.isFinite(nodeData.width) ||
            !Number.isFinite(nodeData.height) ||
            nodeData.width <= 0 ||
            nodeData.height <= 0
        ) {
            return false;
        }

        if (!Array.isArray(nodeData.data) || nodeData.data.length !== nodeData.height) {
            return false;
        }

        for (let y = 0; y < nodeData.height; y++) {
            if (
                !Array.isArray(nodeData.data[y]) ||
                nodeData.data[y].length !== nodeData.width
            ) {
                return false;
            }
        }

        return true;
    }

    K.maskFromPoints = maskFromPoints;
    K.isValidMatrix = isValidMatrix;
})();

