// Узел сохранения
class SaveNode extends LGraphNode  {
    constructor() {
        // Добавляем входящий порт с типом "image" (ожидаем объект ImageData или Canvas)
        super();
        this.addInput("Image", Types.IMAGE); 
        // Свойства узла (по умолчанию)
        this.properties = {
            "width": 10,
            "height": 10,
            "data": "[[0, 0, 0], [0, 255, 0], [0, 0, 0]]", // Начальная матрица (JSON-строка)
            "minValue": 0,
            "maxValue": 255,
            "format": null,
            "filename": null,
            "autoscale": true,
            "colormap": "gray", // Цветовая схема
            "previewData":null
        };
    this.help =
        "Умножает входное значение на 2.\n\n" +
        "Входы:\n" +
        "  in (number) — входное значение\n\n" +
        "Выходы:\n" +
        "  out (number) — in * 2";
        
        // Устанавливаем размер узла [ширина, высота] в пикселях
        this.size = [250, 100];
        this.resizable = false;
        this.title = "Сохранить";
        this.subtitle = "Сохраняет изображение в файл";
        this.icon = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#007acc" stroke-width="2" width="25" height="25" viewBox="0 0 25 25"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`);
    }
    
    // Метод, вызываемый при выполнении узла
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
        // Валидация входных данных
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

        this.properties.width = inputData.width;
        this.properties.height = inputData.height;
        this.properties.data = inputData.data;
        this.properties.minValue = inputData.minValue;
        this.properties.maxValue = inputData.maxValue;
        
        this.properties.autoscale = inputData.autoscale ;
        this.properties.colormap = inputData.colormap;
        
        if (this.properties.filename  == null){
            this.properties.filename = "Result";
            console.log("this.properties.filename = inputData.filename");
        }
        if (this.properties.format == null){
            this.properties.format = "tpt";
            console.log("this.properties.format = inputData.format");
        } 
        const width = this.properties.width;
        const height = this.properties.height;
        const minVal =  this.properties.minValue;
        const maxVal =  this.properties.maxValue;
        let matrix = this.properties.data;


        // const autoscale = true;
        // const colormap = 'gray';
        // const colorMap = getColormap(colormap);
        // const data = new Uint8ClampedArray(width * height * 4);
        // let dataIndex = 0;
        // for (let y = 0; y < width; y++) {width
        //     for (let x = 0; x < height; x++) {
        //         const normalizedValue = autoscale 
        //             ? (matrix[y][x] - minVal) / (maxVal - minVal + 1e-9) 
        //             : (matrix[y][x] - scale[0]) / (scale[1] - scale[0] + 1e-9);
        //         const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
        //         data[dataIndex++] = color.r * 255;
        //         data[dataIndex++] = color.g * 255;
        //         data[dataIndex++] = color.b * 255;
        //         data[dataIndex++] = 255;
        //     }
        // }
        // const canvas = document.createElement('canvas');
        // canvas.width = width;
        // canvas.height = height;
        // const ctx = canvas.getContext('2d');
        // const imageData = new ImageData(data, width, height);
        // ctx.putImageData(imageData, 0, 0);
        // // **Сохраняем изображение в превью** (для визуализации)
        // this.properties.previewData = imageData;
        // var max_result = matrix[0][0];
        // var min_result = matrix[0][0];
        // // for (let y = 0; y < height; y++) {
        //     // for (let x = 0; x < width; x++) {
        // for (let y = 0; y < width; y++) {
        //     for (let x = 0; x < height; x++) {
        //         if(matrix[y][x] > max_result) {
        //             max_result = matrix[y][x];
        //         }
        //         if(matrix[y][x] < min_result) {
        //             min_result = matrix[y][x];
        //         }
        //     }
        // }
    
        const file = {
            dpi : inputData.dpi,
            width : inputData.width,
            height : inputData.height,
            data :inputData.data
        }

   
        if(this.properties.format == "tpt"){
            saveToTptFile(file,  this.properties.filename + "." + this.properties.format)
            .then(message => console.log(message))
            .catch(error => console.error(error));
        }
        // else   {
        //     // Определяем MIME-тип по формату
        //     const mimeTypes = {
        //         'png': 'image/png',
        //         'jpg': 'image/jpeg',
        //         'jpeg': 'image/jpeg',
        //         'webp': 'image/webp',
        //         'gif': 'image/gif',
        //         'bmp': 'image/bmp'
        //     };
        //     const mimeType = mimeTypes[this.properties.format] || 'image/png'; // Защита от неизвестных форматов
        //     // Сохраняем с нужным форматом
        //     const a = document.createElement('a');
        //     a.download =  this.properties.filename;
        //     a.href = canvas.toDataURL(mimeType); // 🔥 Теперь формат учитывается!
        //     a.click();
        // }
    }
    
    onDrawForeground(ctx) {
        if (this.flags.collapsed) return;
        if (this.properties.filename == null || this.properties.format == null) {
            ctx.fillStyle = "#CCC";
            ctx.font = "12px Arial";
            ctx.fillText("SaveName:", 10, 42);
            ctx.fillStyle = "#FFF";
            ctx.fillText(`Файл не выбран`, 75, 42);
            return;
        }
        ctx.fillStyle = "#CCC";
        ctx.font = "12px Arial";
        ctx.fillText("SaveName:", 10, 42);
        ctx.fillStyle = "#FFF";
        ctx.fillText(`${this.properties.filename}.${this.properties.format}`, 75, 42);
    }

}
LiteGraph.registerNodeType("output/SaveNode", SaveNode);
