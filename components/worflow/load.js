// Узел загрузки изображения
class LoadNode extends LGraphNode  {
    constructor() {
        super();
        this.addOutput("Image", Types.IMAGE); 
        this.properties = {
            dpi:254,
            width: null,
            height: null,
            data:null, // Начальная матрица (JSON-строка)
            minValue: null,
            maxValue: null,
            format: "tpt",
            filename: null,
            autoscale: true,
            colormap: "gray" // Цветовая схема
        };




        this.title = "Загрузить";
        this.subtitle = "Загружает изображение из файла";
        // this.icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#007acc" stroke-width="2" width="100" height="100" viewBox="0 0 100 100"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></svg>`;
        // this.icon = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        //     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#4a90d9"/><text x="8" y="12" font-size="10" text-anchor="middle" fill="#fff">A</text></svg>'
        // );


        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" 
        fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" x2="12" y1="15" y2="3"/>
        </svg>`);
        // Кнопка выбора файла
        this._loadWidget = this.addWidget("button", "Загрузить", null, () => {
            this._loadFromFile().catch(err => {
                console.error('LoadNode: ошибка загрузки файла:', err);
            });
        });

        // Кнопка превью
        this._previewWidget = this.addWidget("button", "Превью", null, () => {
            showNodePreview(this);
        });
        this._previewWidget.disabled = true; // изначально неактивна

        
          // this.size = [250, 100];
        this.size = [270, 145];
        this.resizable = false;
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


    /**
     * Открывает диалог выбора .tpt-файла и загружает его в properties.
     * Возвращает Promise: resolve при успехе, reject при ошибке/отмене.
     */
    _loadFromFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.tpt';

            // Отмена диалога (Esc) — иначе промис зависнет
            input.addEventListener('cancel', () => reject('Выбор файла отменён'));

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject('Файл не выбран');
                    return;
                }

                const filenameParts = file.name.split('.');
                const filename = filenameParts.slice(0, -1).join('.');
                const fileExtension = filenameParts.pop().toLowerCase() || 'unknown';
                if (fileExtension !== 'tpt') {
                    reject('Файл должен иметь расширение .tpt');
                    return;
                }

                const reader = new FileReader();
                reader.onerror = () => reject('Ошибка чтения файла');

                reader.onload = (ev) => {
                    try {
                        const lines = ev.target.result.split('\n')
                            .map(line => line.trim())
                            .filter(line => line !== '');

                        if (lines.length < 3) {
                            reject('Файл .tpt должен содержать минимум 3 строки: width, height, matrix');
                            return;
                        }

                        const firstLine = lines[0]?.trim() || '';
                        const hasDpi = firstLine.startsWith('#DPI=');
                        const widthLine = hasDpi ? lines[1] : lines[0];
                        const heightLine = hasDpi ? lines[2] : lines[1];
                        const dpiLine = hasDpi ? lines[0] : '#DPI=254';

                        const dpi = parseFloat(dpiLine.split('=')[1]);
                        const height = parseInt(widthLine, 10);
                        const width = parseInt(heightLine, 10);

                        if (isNaN(width) || isNaN(height)) {
                            reject('Ширина и высота должны быть числами');
                            return;
                        }

                        const matrixStartIndex = hasDpi ? 3 : 2;
                        const matrix = lines.slice(matrixStartIndex).map(line =>
                            line.trim()
                                .split(/\s+/)
                                .filter(token => !token.startsWith('#DPI='))
                                .map(Number)
                        );

                        if (matrix.length !== height) {
                            reject(`Ожидалось ${height} строк матрицы, найдено ${matrix.length}`);
                            return;
                        }

                        if (matrix.some(row => row.length !== width)) {
                            reject(`Все строки матрицы должны содержать ${width} чисел`);
                            return;
                        }

                        if (width * height > 25_000_000) {
                            reject('Матрица слишком большая (максимум 25 000 000 элементов)');
                            return;
                        }

                        let minVal = Infinity, maxVal = -Infinity;
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                const val = matrix[y][x];
                                if (val < minVal) minVal = val;
                                if (val > maxVal) maxVal = val;
                            }
                        }

                        this.properties.dpi = dpi;
                        this.properties.width = width;
                        this.properties.height = height;
                        this.properties.data = matrix;
                        this.properties.minValue = minVal;
                        this.properties.maxValue = maxVal;
                        this.properties.filename = filename;
                        this.properties.format = fileExtension;

                        this.updatePreviewButtonState();
                        this.graph?.setDirtyCanvas(true, true);
                        resolve();
                    } catch (err) {
                        console.error('LoadNode: ошибка парсинга файла:', err);
                        reject('Ошибка парсинга файла: ' + (err.message || err));
                    }
                };

                reader.readAsText(file);
            };

            input.click();
        });
    }

    //Метод `onExecute` вызывается при выполнении узла (например, при нажатии кнопки "Run")
    onExecute() {

        // Проверяем, есть ли загруженные данные в свойствах
        if (this.properties.data) {
        
            // Формируем выходные данные
            const outputData = {
                dpi: this.properties.dpi,
                width: this.properties.width,
                height: this.properties.height,
                data: this.properties.data,
                minValue: this.properties.minValue,
                maxValue: this.properties.maxValue,
                format: this.properties.format,
                filename: this.properties.filename,
                autoscale: this.properties.autoscale,
                colormap: this.properties.colormap
            };

            // Если есть, передаём его через выходной порт (индекс 0 — первый выход)
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
    // Отображение имени загруженного файла (рисуется внутри узла, ниже виджетов)
    onDrawForeground(ctx, canvas) {
        if (this.flags.collapsed) return;
        ctx.save();
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const y = 122;
        if (this.properties.filename == null || this.properties.format == null) {
            ctx.fillStyle = "#CCC";
            ctx.fillText("Файл не выбран", 15, y);
        } else {
            let name = `${this.properties.filename}.${this.properties.format}`;
            const maxW = this.size[0] - 30;
            while (ctx.measureText(name).width > maxW && name.length > 4) {
                name = name.slice(0, -1);
            }
            if (name !== `${this.properties.filename}.${this.properties.format}`) {
                name = name.slice(0, -1) + "…";
            }
            ctx.fillStyle = "#FFF";
            ctx.fillText(name, 15, y);
        }
        ctx.restore();
    }


}
LiteGraph.registerNodeType("input/LoadNode", LoadNode);

