class Sobel extends FilterNode {
    constructor() {
        super();
        this.title = "Собель (границы)";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" 
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        </svg>`);

        this.size = [250, 100];
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
            console.error("Ошибка: вход должен быть подключён для работы узла.");
            alert("Ошибка: вход должен быть подключён для работы узла.");
            return;
        }

        const inputData = this.getInputData(0);
        if (!inputData)  {
            console.error("Входные данные матрицы отсутствуют");
            return;
        }

        // Валидация входных данных
        if (!Array.isArray(inputData.data) ) {
            console.error("Ошибка: входные данные не являются матрицей.");
            return;
        }
        if (inputData.data.length === 0) {
            console.error("Некорректные входные данные: матрица пустая.");
            return;
        }
        if (!Number.isFinite(inputData.minValue) || !Number.isFinite(inputData.maxValue)) {
            console.error("Некорректные minValue/maxValue во входных данных.");
            return;
        }
        if (!Number.isFinite(inputData.height) || !Number.isFinite(inputData.width) || inputData.height <= 0 || inputData.width <= 0) {
            console.error("Ошибка: некорректные размеры матрицы.");
            return;
        }

        const result = ImageOpsKernels.sobelMatrix(
            inputData.height,
            inputData.width,
            inputData.data
        );

        // Формируем выходные данные
        const outputData = {
            dpi:        inputData.dpi,
            width:      inputData.width,
            height:     inputData.height,
            data:       result.data,
            minValue:   result.min_value,
            maxValue:   result.max_value,
            format:     inputData.format,
            filename:   inputData.filename,
            autoscale:  inputData.autoscale,
            colormap:   inputData.colormap
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
LiteGraph.registerNodeType("filter/Sobel", Sobel);
