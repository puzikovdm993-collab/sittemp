class Difference extends CalculationNode {
    constructor() {
        super();
        this.title = "Деление";
        this.subtitle = "Деление Image1 на Image2 поэлементно";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" 
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);

        this.size = [200, 60];
        this.resizable = false;

        // Кнопка превью
        this._previewWidget = this.addWidget("button", "Превью", null, () => {
            showNodePreview(this);
        });
        this._previewWidget.disabled = true; // изначально неактивна
    }

    /**
     * Обновляет состояние кнопки превью
     */
    updatePreviewButtonState() {
        if (!this._previewWidget) return;
        this._previewWidget.disabled = !this.hasData();
    }

    /**
     * Есть ли данные в properties.data
     */
    hasData() {
        const d = this.properties.data;
        if (!d) return false;
        if (d.length === 0) return false;
        // 2D-матрица
        if (Array.isArray(d[0])) return d[0].length > 0;
        // Плоский массив / TypedArray
        return true;
    }

    onExecute() {

        if (!(this.inputs[0] && this.inputs[0].link)) {
            console.error("Ошибка: вход Image1 должен быть подключён для работы узла.");
            return;
        }
        if (!(this.inputs[1] && this.inputs[1].link)) {
            console.error("Ошибка: вход Image2 должен быть подключён для работы узла.");
            return;
        }

        // Получаем входные данные
        const matrixA = this.getInputData(0);
        const matrixB = this.getInputData(1);

        if (!matrixA) {
            console.error("Входные данные матрицы matrixA отсутствуют.");
            return;
        }
        if (!matrixB) {
            console.error("Входные данные матрицы matrixB отсутствуют.");
            return;
        }

        // Валидация входных данных
        if (!Array.isArray(matrixA.data)) {
            console.error("Ошибка: входные данные matrixA не являются матрицей.");
            return;
        }
        if (!Array.isArray(matrixB.data)) {
            console.error("Ошибка: входные данные matrixB не являются матрицей.");
            return;
        }
        if (matrixA.data.length === 0) {
            console.error("Некорректные входные данные: матрица matrixA пустая.");
            return;
        }
        if (matrixB.data.length === 0) {
            console.error("Некорректные входные данные: матрица matrixB пустая.");
            return;
        }
        if (!Number.isFinite(matrixA.minValue) || !Number.isFinite(matrixA.maxValue)) {
            console.error("Некорректные minValue/maxValue matrixA во входных данных.");
            return;
        }
        if (!Number.isFinite(matrixB.minValue) || !Number.isFinite(matrixB.maxValue)) {
            console.error("Некорректные minValue/maxValue matrixB во входных данных.");
            return;
        }
        if (!Number.isFinite(matrixA.height) || !Number.isFinite(matrixA.width) || matrixA.height <= 0 || matrixA.width <= 0) {
            console.error("Ошибка: некорректные размеры матрицы matrixA.");
            return;
        }
        if (!Number.isFinite(matrixB.height) || !Number.isFinite(matrixB.width) || matrixB.height <= 0 || matrixB.width <= 0) {
            console.error("Ошибка: некорректные размеры матрицы matrixB.");
            return;
        }
        if (matrixA.width !== matrixB.width || matrixA.height !== matrixB.height) {
            console.error("Ошибка: размеры матриц matrixA и matrixB не совпадают.");
            return;
        }


        const result = ImageOpsKernels.divisionMatrix(
            matrixA.height,
            matrixA.width,
            matrixA.data,
            matrixB.data
        );

        // Формируем выходные данные
        const outputData = {
            dpi:        matrixA.dpi,
            width:      matrixA.width,
            height:     matrixA.height,
            data:       result.data,
            minValue:   result.min_value,
            maxValue:   result.max_value,
            format:     matrixA.format,
            filename:   matrixA.filename,
            autoscale:  matrixA.autoscale,
            colormap:   matrixA.colormap
        };
        this.setOutputData(0, outputData);


        this.properties.dpi         =   outputData.dpi;
        this.properties.width       =   outputData.width;
        this.properties.height      =   outputData.height;
        this.properties.data        =   outputData.data;
        this.properties.minValue    =   outputData.minValue;
        this.properties.maxValue    =   outputData.maxValue;
        this.properties.format      =   outputData.format;
        this.properties.filename    =   outputData.filename;
        this.properties.autoscale   =   outputData.autoscale;
        this.properties.colormap    =   outputData.colormap;

        // Сохраняем изображение в превью (для визуализации)
        this.properties.previewData = buildMatrixPreview(outputData);

        this.updatePreviewButtonState();
    }
}
LiteGraph.registerNodeType("Calculation/Difference", Difference);

