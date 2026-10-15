// Иконки и подписи напрямую на узлах LiteGraph (заголовок узла).
// Синхронизировано с SVG-спрайтом <symbol id="wf-*"> в wtis_workflow.html.
// Подключается ПОСЛЕ всех registerNodeType-скриптов.

(function () {
    'use strict';

    const ICON_COLOR = '#007acc';
    const STROKE_W = 2;

    // SVG-пути каждой иконки (viewBox 0 0 24 24), дублируют спрайт страницы,
    // чтобы из них можно было собрать data-URI для отрисовки на canvas.
    const WF_ICONS = {
        'wf-edge': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17c2-6 5-9 10-10"/><circle cx="7" cy="17" r="1.2"/><circle cx="17" cy="7" r="1.2"/>',
        'wf-blur': '<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.5"/><circle cx="12" cy="12" r="5" stroke-dasharray="2.5 2"/><circle cx="12" cy="12" r="1.5"/>',
        'wf-normalize': '<polyline points="3 19 9 13 13 17 21 7"/><polyline points="15 7 21 7 21 13"/>',
        'wf-surface': '<path d="M3 17c3.5 0 5.5-9 9-9s5.5 9 9 9"/><path d="M3 21h18"/><path d="M3 7c3.5 0 5.5 5 9 5s5.5-5 9-5"/>',
        'wf-log': '<path d="M3 20C8 20 12 16 14 10 15 7 16 4 21 4"/><circle cx="3" cy="20" r="1"/>',
        'wf-rotate': '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/>',
        'wf-move': '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
        'wf-center': '<rect x="2" y="2" width="20" height="20" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="2" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="22" y2="12"/>',
        'wf-crop': '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
        'wf-threshold': '<line x1="4" y1="4" x2="4" y2="20"/><path d="M8 20h5l3-6 3 6h1"/><path d="M8 10h4l2-4 2 4h2"/>',
        'wf-polar': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/>',
        'wf-trass': '<path d="M3 17c2-6 4-9 6-9s2 4 4 4 3-6 5-8"/><circle cx="3" cy="17" r="1"/><circle cx="18" cy="4" r="1.5"/>',
        'wf-chart': '<line x1="3" y1="3" x2="3" y2="21"/><line x1="3" y1="21" x2="21" y2="21"/><path d="M7 15l4-5 3 3 5-7"/>',
        'wf-table': '<rect x="3" y="4" width="18" height="16" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>',
        'wf-circle-search': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="2.5"/>',
        'wf-line-search': '<line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="4" r="1.5"/><circle cx="10" cy="14" r="1"/><circle cx="15" cy="9" r="1"/>',
        'wf-divide': '<line x1="5" y1="12" x2="19" y2="12"/><circle cx="12" cy="6" r="1.3"/><circle cx="12" cy="18" r="1.3"/>',
        'wf-mask-store': '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
        'wf-merge': '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6c5 0 3 6 8 6"/><path d="M8 18c5 0 3-6 8-6"/>',
        'wf-lasso': '<path d="M7 22a5 5 0 0 1-2-4 5 5 0 0 1 5-5h.5a5 5 0 0 1 0 10H7a3 3 0 0 1-3-3"/><circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="16"/>',
        'wf-rectangle': '<rect x="3" y="5" width="18" height="14" rx="1" stroke-dasharray="4 3"/><circle cx="3" cy="5" r="1.4"/><circle cx="21" cy="5" r="1.4"/><circle cx="3" cy="19" r="1.4"/><circle cx="21" cy="19" r="1.4"/>'
    };

    function iconDataUri(iconId) {
        const paths = WF_ICONS[iconId];
        if (!paths) return null;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${ICON_COLOR}" ` +
            `stroke-width="${STROKE_W}" stroke-linecap="round" stroke-linejoin="round" ` +
            `width="25" height="25" viewBox="0 0 24 24">${paths}</svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    // Тип узла -> { icon: id символа палитры, subtitle: короткое описание }
    const NODE_META = {
        'input/LoadNode':   { icon: 'icon-download',    subtitle: 'Загружает изображение из файла' },
        'output/SaveNode':  { icon: 'icon-upload',      subtitle: 'Сохраняет изображение в файл' },
        'filter/Sobel':     { icon: 'wf-edge',          subtitle: 'Детекция границ (градиент Собеля)' },
        'filter/Median':    { icon: 'wf-blur',          subtitle: 'Медианное подавление шума' },
        'filter/gausse':    { icon: 'wf-blur',          subtitle: 'Гауссово размытие' },
        'filter/LR':        { icon: 'wf-normalize',     subtitle: 'Линейная коррекция' },
        'filter/Normalisation':                    { icon: 'wf-normalize', subtitle: 'Линейная нормализация диапазона' },
        'filter/BackgroundCorrectionPolynomialNode': { icon: 'wf-surface', subtitle: 'Полиномиальная коррекция фона' },
        'filter/Logarithm': { icon: 'wf-log',           subtitle: 'Натуральный логарифм пикселей' },
        'transform/Rotate': { icon: 'wf-rotate',        subtitle: 'Поворот с билинейной интерполяцией' },
        'transform/Shift':  { icon: 'wf-move',          subtitle: 'Смещение матрицы по X/Y' },
        'transform/ShiftCenter': { icon: 'wf-center',   subtitle: 'Центрирование по маске точек' },
        'transform/Crop':   { icon: 'wf-crop',          subtitle: 'Прямоугольная обрезка' },
        'transform/Threshold': { icon: 'wf-threshold',  subtitle: 'Отсечка значений по порогам' },
        'transform/Polar':  { icon: 'wf-polar',         subtitle: 'Декартовы ⇄ полярные координаты' },
        'transform/TracingFilter': { icon: 'wf-trass',  subtitle: 'Построение трассы по профилю' },
        'transform/SaveTrassNode': { icon: 'wf-table',  subtitle: 'Экспорт трассы в файл' },
        'plot/plotly':      { icon: 'wf-chart',         subtitle: 'График Plotly по трассе' },
        'plot/data':        { icon: 'wf-table',         subtitle: 'Извлечение данных c графика' },
        'search/CircleSearch': { icon: 'wf-circle-search', subtitle: 'Поиск центра и радиуса окружности' },
        'search/LineSearch':   { icon: 'wf-line-search',   subtitle: 'Поиск прямой по точкам' },
        'Calculation/Difference': { icon: 'wf-divide',  subtitle: 'Image1 ÷ Image2, поэлементно' },
        'roi/mask_store':   { icon: 'wf-mask-store',    subtitle: 'Хранение маски/точек ROI' },
        'roi/merge_points': { icon: 'wf-merge',         subtitle: 'Объединение наборов точек' },
        'roi/lasso':        { icon: 'wf-lasso',         subtitle: 'Выделение области «лассо»' },
        'roi/rectangle':    { icon: 'wf-rectangle',     subtitle: 'Прямоугольное выделение' },
        'roi/lasso_viewer': { icon: 'wf-eye',           subtitle: 'Просмотр ROI' }
    };

    // Пути базовых иконок из спрайта страницы (для data-URI)
    const BASE_ICONS = {
        'icon-download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
        'icon-upload':   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
        'wf-eye':        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    };

    function getIconUri(iconId) {
        if (WF_ICONS[iconId]) return iconDataUri(iconId);
        if (BASE_ICONS[iconId]) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${ICON_COLOR}" ` +
                `stroke-width="${STROKE_W}" stroke-linecap="round" stroke-linejoin="round" ` +
                `width="25" height="25" viewBox="0 0 24 24">${BASE_ICONS[iconId]}</svg>`;
            return 'data:image/svg+xml;base64,' + btoa(svg);
        }
        return null;
    }

    function applyMeta() {
        if (typeof LiteGraph === 'undefined') return;
        let applied = 0;
        for (const type in NODE_META) {
            const ctor = LiteGraph.getNodeClass(type);
            if (!ctor || !ctor.prototype) continue;
            const meta = NODE_META[type];
            const uri = getIconUri(meta.icon);
            if (uri) {
                Object.defineProperty(ctor.prototype, 'icon', {
                    get: (function (u) { return function () { return u; }; })(uri),
                    set: function () {}, // узлы могут присваивать this.icon — молча игнорируем
                    configurable: true
                });
            }
            if (meta.subtitle && !ctor.prototype.subtitle) {
                ctor.prototype.subtitle = meta.subtitle;
            }

            // Иконки задаются централизованно (см. палитру), а не хранятся в JSON графа:
            // при загрузке сохранённого графа node.configure() перезаписывал бы
            // this.icon/this.subtitle старыми значениями из сериализации — блокируем это.
            if (!ctor.prototype._iconsPatched) {
                const baseConfigure = ctor.prototype.configure;
                ctor.prototype.configure = function (info) {
                    if (info) {
                        info = Object.assign({}, info);
                        delete info.icon;
                        delete info.subtitle;
                        delete info.icon_size;
                        delete info.icon_pos;
                    }
                    return baseConfigure.call(this, info);
                };
                ctor.prototype._iconsPatched = true;
            }

            applied++;
        }
        if (applied) console.log(`🎨 Иконки узлов применены: ${applied}`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyMeta);
    } else {
        applyMeta();
    }
})();
