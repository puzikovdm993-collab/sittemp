// Открытие модального окна
function showTracingModal() {
    const file = getActiveFile();
    if (!file) return;
    document.getElementById('tracingdModal').classList.add('active');
}

// Закрытие модального окна
function closeTracingdModal() {
    document.getElementById('tracingdModal').classList.remove('active');
}

/**
 * Класс-токен для хранения настроек фильтра (аналог EffectPluginToken.cs)
 */
class TracingFilterConfigToken {
    constructor() {
        this.corellation = true;
        this.m_bAutolimit = true;
        this.limitvalue = 0.2;
        this.sensitivity = 0.55;
        this.epsilon = 5;
        this.krivulka = true;
        this.m_bDpi = true;
        this.dpi = 25.4;
        this.m_bMedFilter = false;
        this.win_size = 5;
        this.m_bSave = false;
        this.nameFile = null;
        this.m_bCenter_left = false;
    }

    clone() {
        const copy = new TracingFilterConfigToken();
        Object.assign(copy, this);
        return copy;
    }
}

/**
 * Основной класс фильтра трассировки (аналог EffectPlugin.cs)
 */
class TracingFilterEffect {
    constructor() {
        // Внутренние переменные состояния
        this.step = 1;
        this.imageData = null; // Float32Array
        this.size_x = 0;
        this.size_y = 0;
        
        this.etalon_v1 = null;
        this.break_center_etalon = 0;
        this.trass_coords_v1 = [];
        this.trass_coords_up_v1 = [];
        this.trass_coords_down_v1 = [];
        this.null_koord_x = 0;
        this.null_koord_y = 0;
    }

    /**
     * Главный метод рендеринга/обработки
     * @param {Object} srcSurface - Объект с данными изображения { data: Float32Array, width, height }
     * @param {Object} dstSurface - Объект для записи результата { data: Float32Array, width, height }
     * @param {TracingFilterConfigToken} token - Параметры фильтра
     * @param {Object} selectionRegion - { left, top, right, bottom }
     */
    render(srcSurface, dstSurface, token, selectionRegion) {
        const { width: size_x, height: size_y } = srcSurface;
        this.size_x = size_x;
        this.size_y = size_y;
        this.step = 1;

        // Копируем настройки из токена
        const cfg = token;
        // 1. Подготовка тестовой линии (усреднение по вертикали в области выделения)
        const rect1 = selectionRegion;
        const rect1Width = rect1.right - rect1.left;
        const rect1Height = rect1.bottom - rect1.top;
        const testline = new Float32Array(rect1Width);
        this.null_koord_y = Math.floor((rect1.top + rect1.bottom) / 2);

        for (let x = rect1.left; x < rect1.right; x++) {
            let summy = 0;
            for (let y = rect1.top; y < rect1.bottom; y++) {
                summy += srcSurface.data[y * size_x + x];
                //console.log(y,' ', x, ' ',srcSurface.data[y * size_x + x])
            }
            testline[x - rect1.left] = summy / rect1Height;
        }

        // 2. Копирование данных изображения во внутренний массив
        this.imageData = new Float32Array(srcSurface.data);

        // 3. Определение эталона
        if (this.defineEtalon(testline, cfg) !== 0) {
         
            throw new Error("Ошибка: Не удалось определить эталон. Проверьте входные данные.");
        }
        this.null_koord_x = Math.floor(this.break_center_etalon) + rect1.left;

        // 4. Трассировка (вверх и вниз)
        if (cfg.corellation) {
            this.trassUp(cfg);
            this.trassDown(cfg);
        } else {
            this.trassUpMax(cfg);
            this.trassDownMax(cfg);
        }

        // 5. Семантизация и фильтрация
        this.semantization(cfg);

        // // 6. Сохранение в файл
        // if (cfg.m_bSave && cfg.nameFile) {
        //     this.saveTrass(cfg);
        // }

        // // 7. Запись результата в dstSurface
        // dstSurface.data.set(this.imageData);

        dstSurface.data = this.trass_coords_v1.filter(v => v !== undefined);

    }

    getIndexMax(testline) {
        let index = 0;
        let maxval = -1e10;
        for (let i = 0; i < testline.length; i++) {
            if (testline[i] >= maxval) {
                index = i;
                maxval = testline[i];
            }
        }
        return index;
    }

    defineEtalon(testline, cfg) {
        let limitValue = cfg.limitvalue;
       
        if (cfg.m_bAutolimit) {
            let max = -1e10;
            let min = 1e10;
            for (let i = 0; i < testline.length; i++) {
                if (testline[i] > max) max = testline[i];
                if (testline[i] < min) min = testline[i];
            }
            if (max === min) return 1;

            for (let i = 0; i < testline.length; i++) {
                testline[i] = (testline[i] - min) / (max - min);
            }
            limitValue = 0.5;
        }

        let kol_in = 0, kol_out = 0;
        for (let i = 0; i < testline.length - 1; i++) {
            if (testline[i] >= limitValue && testline[i + 1] < limitValue) kol_in++;
            if (testline[i] < limitValue && testline[i + 1] >= limitValue) kol_out++;
        }

        if (kol_in !== kol_out || kol_in > 1 || kol_out > 1) return 1;

        this.break_center_etalon = this.getIndexMax(testline);
        this.etalon_v1 = new Float32Array(testline);
        return 0;
    }

    trassUp(cfg) {
        const searchLength = 2 * cfg.epsilon;
        let center = this.null_koord_x;
        this.trass_coords_up_v1 = [];

        for (let j = Math.floor(this.null_koord_y) - this.step; j >= 0; j -= this.step) {
            let maxCor = -1e10;
            let indMaxCor = 0;

            for (let k = 0; k < searchLength; k++) {
                let s_ab = 0, aa = 0, bb = 0;
                let medVal = 0, medValEt = 0;
                const shift = Math.floor(this.break_center_etalon) + cfg.epsilon;

                for (let l = 0; l < this.etalon_v1.length; l++) {
                    const ind_x = Math.floor(center) - shift + k + l;
                    if (ind_x >= this.size_x || ind_x < 0) break;
                    medVal += this.imageData[j * this.size_x + ind_x] / this.etalon_v1.length;
                    medValEt += this.etalon_v1[l] / this.etalon_v1.length;
                }

                for (let l = 0; l < this.etalon_v1.length; l++) {
                    const ind_x = Math.floor(center) - shift + k + l;
                    if (ind_x >= this.size_x || ind_x < 0) break;
                    const a = this.etalon_v1[l] - medValEt;
                    const b = this.imageData[j * this.size_x + ind_x] - medVal;
                    s_ab += a * b;
                    aa += a * a;
                    bb += b * b;
                }

                const m_fsqrt = Math.sqrt(aa * bb);
                const koifCorr = Math.abs(m_fsqrt) > 1e-9 ? s_ab / m_fsqrt : 0;

                if (koifCorr >= maxCor) {
                    maxCor = koifCorr;
                    indMaxCor = k;
                }
            }

            if (maxCor > cfg.sensitivity) {
                const shift = Math.floor(this.break_center_etalon) + cfg.epsilon;
                center = center - shift + indMaxCor + this.break_center_etalon;
            }

            center = Math.max(0, Math.min(this.size_x - 1, center));
            this.trass_coords_up_v1[j] = [center, j];
        }
    }

    trassDown(cfg) {
        const searchLength = 2 * cfg.epsilon;
        let center = this.null_koord_x;
        this.trass_coords_down_v1 = [];

        for (let j = Math.floor(this.null_koord_y); j < this.size_y; j += this.step) {
            let maxCor = -1e10;
            let indMaxCor = 0;

            for (let k = 0; k < searchLength; k++) {
                let s_ab = 0, aa = 0, bb = 0;
                let medVal = 0, medValEt = 0;
                const shift = Math.floor(this.break_center_etalon) + cfg.epsilon;

                for (let l = 0; l < this.etalon_v1.length; l++) {
                    const ind_x = Math.floor(center) - shift + k + l;
                    if (ind_x >= this.size_x || ind_x < 0) break;
                    medVal += this.imageData[j * this.size_x + ind_x] / this.etalon_v1.length;
                    medValEt += this.etalon_v1[l] / this.etalon_v1.length;
                }

                for (let l = 0; l < this.etalon_v1.length; l++) {
                    const ind_x = Math.floor(center) - shift + k + l;
                    if (ind_x >= this.size_x || ind_x < 0) break;
                    const a = this.etalon_v1[l] - medValEt;
                    const b = this.imageData[j * this.size_x + ind_x] - medVal;
                    s_ab += a * b;
                    aa += a * a;
                    bb += b * b;
                }

                const m_fsqrt = Math.sqrt(aa * bb);
                const koifCorr = Math.abs(m_fsqrt) > 1e-9 ? s_ab / m_fsqrt : 0;

                if (koifCorr >= maxCor) {
                    maxCor = koifCorr;
                    indMaxCor = k;
                }
            }

            if (maxCor > cfg.sensitivity) {
                const shift = Math.floor(this.break_center_etalon) + cfg.epsilon;
                center = center - shift + indMaxCor + this.break_center_etalon;
            }

            center = Math.max(0, Math.min(this.size_x - 1, center));
            this.trass_coords_down_v1[j - Math.floor(this.null_koord_y)] = [center, j];
        }
    }

    trassUpMax(cfg) {
        const searchLength = 2 * cfg.epsilon + this.etalon_v1.length;
        let center = this.null_koord_x;
        this.trass_coords_up_v1 = [];

        for (let j = Math.floor(this.null_koord_y) - this.step; j >= 0; j -= this.step) {
            let maxVal = -1e10;
            let indMaxVal = 0;
            const shift = Math.floor(this.break_center_etalon) + cfg.epsilon;

            for (let k = 0; k < searchLength; k++) {
                const ind_x = Math.floor(center) - shift + k;
                if (ind_x >= this.size_x || ind_x < 0) break;
                if (this.imageData[j * this.size_x + ind_x] >= maxVal) {
                    maxVal = this.imageData[j * this.size_x + ind_x];
                    indMaxVal = k;
                }
            }
            center = center - shift + indMaxVal;
            center = Math.max(0, Math.min(this.size_x - 1, center));
            this.trass_coords_up_v1[j] = [center, j];
        }
    }

    trassDownMax(cfg) {
        const searchLength = 2 * cfg.epsilon + this.etalon_v1.length;
        let center = this.null_koord_x;
        this.trass_coords_down_v1 = [];

        for (let j = Math.floor(this.null_koord_y); j < this.size_y; j += this.step) {
            let maxVal = -1e10;
            let indMaxVal = 0;
            const shift = Math.floor(this.break_center_etalon) + cfg.epsilon;

            for (let k = 0; k < searchLength; k++) {
                const ind_x = Math.floor(center) - shift + k;
                if (ind_x >= this.size_x || ind_x < 0) break;
                if (this.imageData[j * this.size_x + ind_x] >= maxVal) {
                    maxVal = this.imageData[j * this.size_x + ind_x];
                    indMaxVal = k;
                }
            }
            center = center - shift + indMaxVal;
            center = Math.max(0, Math.min(this.size_x - 1, center));
            this.trass_coords_down_v1[j - Math.floor(this.null_koord_y)] = [center, j];
        }
    }

    medianFilter(window, len, val) {
        const r = Math.floor(window / 2);
        const ms = new Float32Array(val);
        const win = new Float32Array(window);

        for (let j = 0; j < len; j++) {
            for (let k = 0; k < window; k++) {
                let ind = j - r + k;
                if (ind < 0) ind = len - 1 + ind;
                if (ind >= len) ind = ind - len;
                win[k] = ms[ind];
            }
            win.sort();
            val[j] = win[r];
        }
    }

    semantization(cfg) {
        this.trass_coords_v1 = new Array(this.size_y);

        // Объединяем верхнюю и нижнюю части трассы
        for (let j = 0; j < this.trass_coords_up_v1.length; j++) {
            if (this.trass_coords_up_v1[j]) {
                this.trass_coords_v1[j] = [...this.trass_coords_up_v1[j]];
            }
        }
        const upLen = this.trass_coords_up_v1.length;
        for (let j = 0; j < this.trass_coords_down_v1.length; j++) {
            if (this.trass_coords_down_v1[j]) {
                this.trass_coords_v1[upLen + j] = [...this.trass_coords_down_v1[j]];
            }
        }

        // Медианный фильтр
        if (cfg.m_bMedFilter && cfg.win_size > 2) {
            const tras = new Float32Array(this.size_y);
            for (let j = 0; j < this.size_y; j++) {
                tras[j] = this.trass_coords_v1[j] ? this.trass_coords_v1[j][0] : 0;
            }
            this.medianFilter(cfg.win_size, this.size_y, tras);
            for (let j = 0; j < this.size_y; j++) {
                if (this.trass_coords_v1[j]) this.trass_coords_v1[j][0] = tras[j];
            }
        }

        let pixSizeMm = 1.0;
        if (cfg.m_bDpi && cfg.dpi > 1.0) {
            pixSizeMm = 25.4 / cfg.dpi;
            for (let j = 0; j < this.size_y; j++) {
                if (this.trass_coords_v1[j]) this.trass_coords_v1[j][0] *= pixSizeMm;
            }
        }

        if (cfg.krivulka) {
            for (let j = 0; j < this.size_y; j++) {
                if (this.trass_coords_v1[j]) {
                    const xIdx = Math.floor(this.trass_coords_v1[j][0] / pixSizeMm);
                    const yIdx = Math.floor(this.trass_coords_v1[j][1]);
                    if (xIdx >= 0 && xIdx < this.size_x && yIdx >= 0 && yIdx < this.size_y) {
                        this.imageData[yIdx * this.size_x + xIdx] = 1.0;
                    }
                }
            }
        }

        if (cfg.m_bCenter_left) {
            for (let j = 0; j < this.size_y; j++) {
                if (this.trass_coords_v1[j]) {
                    this.trass_coords_v1[j][0] = Math.abs(pixSizeMm * (this.size_x / 2.0) - this.trass_coords_v1[j][0]);
                }
            }
        }

        if (!cfg.krivulka) {
            this.imageData.fill(0);
            for (let j = 0; j < this.size_y; j++) {
                if (this.trass_coords_v1[j]) {
                    this.imageData[j * this.size_x + this.null_koord_x] = this.trass_coords_v1[j][0];
                }
            }
        }
    }

    saveTrass(cfg) {
        let content = `#DPI=${cfg.dpi}\n`;
        const rows = this.trass_coords_v1.filter(v => v !== undefined);
        content += `${rows.length}\n`;
        content += `${rows[0] ? rows[0].length : 0}\n`;

        for (let row of rows) {
            content += row.join(" ") + "\n";
        }


        // Если filename не указан, используем оригинальный или генерируем новый
        const outputFilename = '1.tpt' || originalFilename || `matrix_${Date.now()}.tpt`;
        // Создаём Blob (UTF-8 текст)
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        // Альтернативный способ (без FileSaver.js)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outputFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    }
}

// ==========================================
// Пример использования
// ==========================================
// Импортируем классы (предположим, они в том же файле или импортированы)

async function runTracingExample(width,height,selection,filedata) {
    const config = new TracingFilterConfigToken();
    config.corellation = true;              // Использовать корреляционный поиск
    config.sensitivity = 0.75;              // Чувствительность
    config.epsilon = 5;                     // Область поиска вокруг предыдущей точки
    config.m_bSave = true;                  // Включить сохранение в файл
    config.nameFile = "result_trace.txt"; 
    config.m_bMedFilter = false;            // Включить медианную фильтрацию (сглаживание)
    config.win_size = 15;                   // Размер окна медианного фильтра
    config.krivulka = true;                 // Отрисовать линию прямо в выходном массиве
    config.m_bDpi = true;
    config.dpi = 300;                       // Устанавливаем DPI для перевода в мм

    const srcData = new Float32Array(width * height).fill(0.1); // Серый фон

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            srcData[y * width + x] = filedata[y][x]; // Белая линия
        }
    }

    const srcSurface = {
        width: width,
        height: height,
        data: srcData
    };
    const dstSurface = {
        width: width,
        height: height,
        data: new Float32Array(width * height)
    };

    try {
        filter.render(srcSurface, dstSurface, config, selection);
    } catch (error) {
        console.error("Ошибка при обработке:", error.message);
    }
}


// #region [Трассировка]
// Применение Трассировка
function applyTracingFilter() {

    const file = getActiveFile();
    if (!file) return;
    
    const selection = {
        left: file.selection.x,
        top: file.selection.y,
        right: file.selection.x + file.selection.w,
        bottom: file.selection.y + file.selection.h
    };
    runTracingExample(file.width,file.height,selection,file.matrix);


}
// #endregion






function runTracingExampleCONFIG(width,height,selection,filedata, configure) {

    const config = new TracingFilterConfigToken();
    config.corellation = configure.corellation;              // Использовать корреляционный поиск
    config.sensitivity = configure.sensitivity;              // Чувствительность
    config.epsilon = configure.epsilon;                     // Область поиска вокруг предыдущей точки
    config.m_bSave = configure.m_bSave;                  // Включить сохранение в файл
    config.nameFile = configure.nameFile; 
    config.m_bMedFilter = configure.m_bMedFilter;            // Включить медианную фильтрацию (сглаживание)
    config.win_size = configure.win_size;                   // Размер окна медианного фильтра
    config.krivulka = configure.krivulka;                 // Отрисовать линию прямо в выходном массиве
    config.m_bDpi = configure.m_bDpi;
    config.dpi = configure.dpi;                       // Устанавливаем DPI для перевода в мм

    const srcData = new Float32Array(width * height).fill(0.1); // Серый фон
 
    for (let y = 0; y < width; y++) {
        for (let x = 0; x < height; x++) {
    // for (let y = 0; y < height; y++) {
    //     for (let x = 0; x < width; x++) {
            srcData[y * width + x] = filedata[y][x]; // Белая линия
        }
    }
    console.log(config);
    const srcSurface = {
        width: width,
        height: height,
        data: srcData
    };

    const filter = new TracingFilterEffect();

 
    let  dstSurface = {data:0};

    try {
        filter.render(srcSurface, dstSurface, config, selection);
    } catch (error) {
        console.error("Ошибка при обработке:", error.message);
    }
    return dstSurface.data;
}
