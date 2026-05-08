// Конфигурация меню по умолчанию
let radialMenuConfig = {
    enabled: true,
    radius: 90,
    items: [
        { id: 'undo', icon: 'icon-undo', label: 'Отменить', action: 'undo', enabled: true },
        { id: 'redo', icon: 'icon-redo', label: 'Повторить', action: 'redo', enabled: true },
        { id: 'copy', icon: 'icon-copy', label: 'Копировать', action: 'copy', enabled: true },
        { id: 'paste', icon: 'icon-paste', label: 'Вставить', action: 'paste', enabled: true },
        { id: 'cut', icon: 'icon-cut', label: 'Вырезать', action: 'cut', enabled: true },
        { id: 'zoom-in', icon: 'icon-zoom-in', label: 'Увеличить', action: 'zoomIn', enabled: true },
        { id: 'zoom-out', icon: 'icon-zoom-out', label: 'Уменьшить', action: 'zoomOut', enabled: true },
        { id: 'rotate', icon: 'icon-rotate-right', label: 'Повернуть', action: 'rotate', enabled: true },
        // Фильтры
        { id: 'sobel', icon: 'SobelEffectPluginIcon', label: 'Edge фильтр', action: 'sobel', enabled: false },
        { id: 'median', icon: 'MedianEffectPluginIcon', label: 'Медианный', action: 'median', enabled: false },
        { id: 'approximation', icon: 'ApproximationEffectPluginIcon', label: 'Аппроксимация', action: 'approximation', enabled: false },
        { id: 'logarithm', icon: 'PrelimProcessIcon', label: 'Предобработка', action: 'logarithm', enabled: false },
        { id: 'contour', icon: 'KONTUREffectPluginIcon', label: 'Контур', action: 'contour', enabled: false },
        { id: 'edge-detect', icon: 'EdgeDetectEffectIcon', label: 'Определение границ', action: 'edgeDetect', enabled: false },
        { id: 'normalization', icon: 'NormalizEffectPluginIcon', label: 'Нормализация', action: 'normalization', enabled: false },
        { id: 'round-search', icon: 'RoundSearchingIcon', label: 'Поиск кругов', action: 'roundSearch', enabled: false }
    ]
};

// Максимальное количество элементов в радиальном меню
const MAX_MENU_ITEMS = 10;

// Состояние модального окна конфигурации
let modalState = {
    isOpen: false,
    isDirty: false,
    originalConfig: null,
    currentConfig: null,
    validationErrors: [],
    resolvePromise: null,
    rejectPromise: null
};

// Состояние меню
let radialMenuVisible = false;
let radialMenuElement = null;
let radialMenuCenterX = 0;
let radialMenuCenterY = 0;

// Обработчик движения мыши для скрытия меню при выходе за пределы
function handleRadialMenuMouseMove(e) {
    if (!radialMenuVisible || !radialMenuElement) return;
    
    const distance = Math.sqrt(
        Math.pow(e.clientX - radialMenuCenterX, 2) + 
        Math.pow(e.clientY - radialMenuCenterY, 2)
    );
    
    // Если курсор вышел за пределы меню (радиус + запас для контура 80px + небольшой буфер 10px)
    // 40px = половина от 80px запаса контура
    const menuBoundary = radialMenuConfig.radius + 10;
    if (distance > menuBoundary) {
        hideRadialMenu();
    }
}

// Создание HTML элемента радиального меню
function createRadialMenu() {
    if (radialMenuElement) return radialMenuElement;

    const menu = document.createElement('div');
    menu.id = 'radialMenu';
    menu.className = 'radial-menu';
    menu.style.display = 'none';

    // Центральная кнопка (закрыть меню)
    const centerBtn = document.createElement('button');
    centerBtn.className = 'radial-menu-center';
    centerBtn.innerHTML = '<svg class="icon" style="fill:var(--text-primary);"><use href="#icon-close"></use></svg>';
    centerBtn.onclick = hideRadialMenu;
    menu.appendChild(centerBtn);

    // Элементы меню
    renderRadialMenuItems(menu);

    document.body.appendChild(menu);
    radialMenuElement = menu;
    return menu;
}

// Отрисовка элементов меню
function renderRadialMenuItems(menu) {
    // Удаляем старые элементы кроме центральной кнопки
    const oldItems = menu.querySelectorAll('.radial-menu-item');
    oldItems.forEach(item => item.remove());

    const radius = radialMenuConfig.radius;
    
    // Получаем все активные элементы
    const allItems = radialMenuConfig.items.filter(i => i.enabled);
    const itemCount = allItems.length;
    
    const angleStep = itemCount > 0 ? (2 * Math.PI) / itemCount : 0;

    // Отрисовка всех элементов в одном ряду
    allItems.forEach((item, index) => {

        // Вычисляем угол для элемента меню
        const angle = index * angleStep - Math.PI / 2; // Начинаем сверху

        // Поворачиваем сегмент вокруг центра
        const rotation = angle * (180 / Math.PI) +90; // Конвертируем в градусы
        const notrotation = 360 - rotation; // Конвертируем в градусы


        const btn = document.createElement('button');
        btn.className = 'radial-menu-item';
        btn.dataset.action = item.action;
        btn.title = item.label;
        
        // Создаем контейнер для содержимого
        const content = document.createElement('div');
        content.className = 'radial-menu-item-content';
        
        const icon = document.createElement('svg');
        icon.className = 'tool-icon';
        icon.innerHTML = `<svg class="icon" style = "fill:var(--text-primary);" ><use href="#${item.icon}"></use>></svg>`;
        icon.style.transform = `rotate(${notrotation}deg)`;
        
        content.appendChild(icon);
        btn.appendChild(content);

        btn.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            handleRadialMenuAction(item.action);
            hideRadialMenu();
        };
        
        menu.appendChild(btn);
    });
}

// Показ меню в указанных координатах
function showRadialMenu(x, y) {
    if (!radialMenuConfig.enabled) return;

    const menu = createRadialMenu();
    
    // Перерисовываем элементы меню с текущей конфигурацией
    renderRadialMenuItems(menu);
    
    const items = menu.querySelectorAll('.radial-menu-item');
    
    if (items.length === 0) return; // Нет элементов для отображения
    
    // Позиционируем само меню в точке клика
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
    
    // Устанавливаем CSS переменную для радиуса и добавляем класс active для отображения контура
    menu.style.setProperty('--radial-menu-radius', `${radialMenuConfig.radius}px`);
    menu.classList.add('active');

    // Сохраняем центр меню для отслеживания выхода курсора
    radialMenuCenterX = x;
    radialMenuCenterY = y;

    radialMenuVisible = true;
}

// Скрытие меню
function hideRadialMenu() {
    if (radialMenuElement) {
        radialMenuElement.style.display = 'none';
        radialMenuElement.classList.remove('active');
    }
    radialMenuVisible = false;
}

// Обработка действий меню
function handleRadialMenuAction(action) {
    switch (action) {
        case 'undo':
            if (typeof undo === 'function') undo();
            break;
        case 'redo':
            if (typeof redo === 'function') redo();
            break;
        case 'copy':
            // Функция закомментирована в imageOps.js
            console.log('Копирование: функция недоступна');
            break;
        case 'paste':
            // Функция закомментирована в imageOps.js
            console.log('Вставка: функция недоступна');
            break;
        case 'cut':
            // Функция закомментирована в imageOps.js
            console.log('Вырезание: функция недоступна');
            break;
        case 'zoomIn':
            if (typeof zoomIn === 'function') zoomIn();
            break;
        case 'zoomOut':
            if (typeof zoomOut === 'function') zoomOut();
            break;
        case 'rotate':
            if (typeof rotateCanvas === 'function') rotateCanvas(90);
            break;
        // Фильтры
        case 'sobel':
            if (typeof applySobelFilter === 'function') applySobelFilter();
            break;
        case 'median':
            if (typeof applyMedianFilter === 'function') applyMedianFilter();
            break;
        case 'approximation':
            if (typeof applyApproximationFilter === 'function') applyApproximationFilter();
            break;
        case 'logarithm':
            if (typeof applyLogorifmFilter === 'function') applyLogorifmFilter();
            break;
        case 'contour':
            if (typeof applyRoundSearchingFilter === 'function') applyRoundSearchingFilter();
            break;
        case 'edgeDetect':
            if (typeof applySobelFilter === 'function') applySobelFilter();
            break;
        case 'normalization':
            if (typeof applyNormalisatioFilter === 'function') applyNormalisatioFilter();
            break;
        case 'roundSearch':
            if (typeof applyRoundSearchingFilter === 'function') applyRoundSearchingFilter();
            break;
        default:
            console.log('Действие не назначено:', action);
    }
}

// Обработчик контекстного меню на canvas
function handleCanvasContextMenu(e) {
    e.preventDefault();
    
    const file = getActiveFile();
    if (!file || !file.canvas) return;
    
    
    const x = e.clientX;
    const y = e.clientY;
    
    if (radialMenuVisible) {
        hideRadialMenu();
    } else {
        showRadialMenu(x, y);
    }
}

// ============================================
// Модальное окно конфигурации радиального меню
// ============================================

// Конфигурация инструментов по умолчанию
const defaultTools = [
    { id: 'undo', icon: 'icon-undo', label: 'Отменить', action: 'undo', enabled: true },
    { id: 'redo', icon: 'icon-redo', label: 'Повторить', action: 'redo', enabled: true },
    { id: 'copy', icon: 'icon-copy', label: 'Копировать', action: 'copy', enabled: true },
    { id: 'paste', icon: 'icon-paste', label: 'Вставить', action: 'paste', enabled: true },
    { id: 'cut', icon: 'icon-cut', label: 'Вырезать', action: 'cut', enabled: true },
    { id: 'zoom-in', icon: 'icon-zoom-in', label: 'Увеличить', action: 'zoomIn', enabled: true },
    { id: 'zoom-out', icon: 'icon-zoom-out', label: 'Уменьшить', action: 'zoomOut', enabled: true },
    { id: 'rotate', icon: 'icon-rotate-right', label: 'Повернуть', action: 'rotate', enabled: true }
];

// Конфигурация фильтров по умолчанию
const defaultFilters = [
    { id: 'sobel', icon: 'SobelEffectPluginIcon', label: 'Edge фильтр', action: 'sobel', enabled: false },
    { id: 'median', icon: 'MedianEffectPluginIcon', label: 'Медианный', action: 'median', enabled: false },
    { id: 'approximation', icon: 'ApproximationEffectPluginIcon', label: 'Аппроксимация', action: 'approximation', enabled: false },
    { id: 'logarithm', icon: 'PrelimProcessIcon', label: 'Предобработка', action: 'logarithm', enabled: false },
    { id: 'contour', icon: 'KONTUREffectPluginIcon', label: 'Контур', action: 'contour', enabled: false },
    { id: 'edge-detect', icon: 'EdgeDetectEffectIcon', label: 'Определение границ', action: 'edgeDetect', enabled: false },
    { id: 'normalization', icon: 'NormalizEffectPluginIcon', label: 'Нормализация', action: 'normalization', enabled: false },
    { id: 'round-search', icon: 'RoundSearchingIcon', label: 'Поиск кругов', action: 'roundSearch', enabled: false }
];

// Создание HTML структуры модального окна
function createRadialMenuConfigModalHTML() {
    if (document.getElementById('radialMenuConfigModal')) return;

    const modalHTML = `
<div class="modal" id="radialMenuConfigModal">
    <div class="modal-content radial-menu-config-modal">
        <div class="modal-title">
            <span>Конфигурация радиального меню</span>
            <button onclick="closeRadialMenuConfigModal()">✕</button>
        </div>
        <div class="modal-body radial-menu-config-body">
            <!-- Левая панель: Конфигурация -->
            <div class="config-panel">
                <div class="panel-section">
                    <div class="panel-header">
                        <span>🛠️ Инструменты</span>
                    </div>
                    <div class="panel-content tools-list" id="toolsList">
                        <!-- Кнопки инструментов будут добавлены динамически -->
                    </div>
                </div>
                <div class="panel-section">
                    <div class="panel-header">
                        <span>🔍 Фильтры</span>
                    </div>
                    <div class="panel-content filters-list" id="filtersList">
                        <!-- Кнопки фильтров будут добавлены динамически -->
                    </div>
                </div>
                <div class="panel-section settings-section" style="display:none;">
                    <div class="panel-header">
                        <span>⚙️ Настройки</span>
                    </div>
                    <div class="panel-content settings-content">
                        <div class="setting-row">
                            <label for="menuRadius">Радиус меню (px):</label>
                            <input type="number" id="menuRadius" min="50" max="200" value="90">
                        </div>
                        <div class="setting-row">
                            <label for="menuEnabled">Включено:</label>
                            <input type="checkbox" id="menuEnabled" checked>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Правая панель: Предпросмотр -->
            <div class="preview-panel">
                <div class="preview-content" id="previewContent">
                    <!-- Радиальное меню для превью будет отрисовано здесь -->
                </div>
            </div>
        </div>
        
        <!-- Панель действий -->
        <div class="action-panel">
            <div class="dirty-indicator" id="dirtyIndicator">
                <span class="dot"></span>
                <span>Несохраненные изменения</span>
            </div>
            <div class="action-buttons">
                <button class="btn btn-cancel" onclick="closeRadialMenuConfigModal()">Отменить</button>
                <button class="btn btn-save" id="saveButton" onclick="saveRadialMenuConfigFromModal()" disabled>Сохранить</button>
            </div>
        </div>
        <div class="modal-resize-handle"></div>
    </div>
</div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Инициализация модального окна конфигурации
function initRadialMenuConfigModal() {
    createRadialMenuConfigModalHTML();
    
    const modal = document.getElementById('radialMenuConfigModal');
    if (!modal) return;

    // Обработчик закрытия по ESC
    document.addEventListener('keydown', handleConfigModalKeyDown);
    
    // Обработчик клика вне области окна
    modal.addEventListener('mousedown', handleConfigModalOutsideClick);
    
    // Обработчики изменений в полях ввода
    const inputs = modal.querySelectorAll('input[type="number"], input[type="checkbox"]');
    inputs.forEach(input => {
        input.addEventListener('change', handleConfigModalInputChange);
        input.addEventListener('input', handleConfigModalInputChange);
    });
    
    console.log('✅ Модальное окно конфигурации радиального меню инициализировано');
}

// Обработчик нажатия клавиш
function handleConfigModalKeyDown(e) {
    if (!modalState.isOpen) return;
    
    if (e.key === 'Escape') {
        e.preventDefault();
        closeRadialMenuConfigModal();
    }
}

// Обработчик клика вне области окна
function handleConfigModalOutsideClick(e) {
    if (!modalState.isOpen) return;
    
    const modalContent = document.querySelector('.radial-menu-config-modal');
    if (modalContent && !modalContent.contains(e.target)) {
        closeRadialMenuConfigModal();
    }
}

// Обработчик изменений в полях ввода
function handleConfigModalInputChange() {
    markAsDirty();
    updatePreview();
    validateAndEnableSave();
}

// Отметка о наличии несохраненных изменений
function markAsDirty() {
    modalState.isDirty = true;
    updateDirtyIndicator();
}

// Обновление индикатора несохраненных изменений
function updateDirtyIndicator() {
    const indicator = document.getElementById('dirtyIndicator');
    if (indicator) {
        indicator.style.opacity = modalState.isDirty ? '1' : '0';
    }
}

// Валидация и активация кнопки сохранения
function validateAndEnableSave() {
    const saveButton = document.getElementById('saveButton');
    if (!saveButton) return;

    const errors = validateConfig();
    modalState.validationErrors = errors;
    
    // Кнопка активна только если нет ошибок валидации
    const isValid = errors.length === 0;
    
    saveButton.disabled = !isValid;
    saveButton.style.opacity = isValid ? '1' : '0.5';
    saveButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
}

// Валидация конфигурации
function validateConfig() {
    const errors = [];
    const config = modalState.currentConfig;
    
    if (!config) {
        errors.push('Конфигурация не загружена');
        return errors;
    }
    
    if (config.radius < 50 || config.radius > 200) {
        errors.push('Радиус должен быть от 50 до 200 px');
    }
    
    // Проверка количества включенных элементов
    const enabledCount = config.items.filter(item => item.enabled).length;
    if (enabledCount === 0) {
        errors.push('Выберите хотя бы один элемент для отображения в меню');
    } else if (enabledCount > MAX_MENU_ITEMS) {
        errors.push(`Превышен лимит элементов: максимально ${MAX_MENU_ITEMS}, выбрано ${enabledCount}`);
    }
    
    return errors;
}

// Рендеринг списка инструментов
function renderToolsList() {
    const container = document.getElementById('toolsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const tools = modalState.currentConfig.items.filter(item => 
        defaultTools.some(t => t.id === item.id)
    );
    
    tools.forEach((item, index) => {
        const toolItem = createToolItem(item, index, 'tool');
        container.appendChild(toolItem);
    });
}

// Рендеринг списка фильтров
function renderFiltersList() {
    const container = document.getElementById('filtersList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const filters = modalState.currentConfig.items.filter(item => 
        defaultFilters.some(f => f.id === item.id)
    );
    
    filters.forEach((item, index) => {
        const filterItem = createToolItem(item, index, 'filter');
        container.appendChild(filterItem);
    });
}

// Создание элемента инструмента/фильтра
function createToolItem(item, index, type) {
    const container = document.createElement('div');
    container.className = `${type}-item`;
    container.dataset.itemId = item.id;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `item-${item.id}`;
    checkbox.checked = item.enabled;
    checkbox.onchange = () => toggleItemEnabled(item.id, checkbox.checked);
    
    const icon = document.createElement('svg');
    icon.className = 'item-icon';
    icon.innerHTML = `<svg class="icon" style="fill:var(--text-primary);"><use href="#${item.icon}"></use>></svg>`;

    const label = document.createElement('label');
    label.htmlFor = `item-${item.id}`;
    label.textContent = item.label;
    
    container.appendChild(checkbox);
    container.appendChild(icon);
    container.appendChild(label);
    
    return container;
}

// Переключение состояния элемента
function toggleItemEnabled(itemId, enabled) {
    const item = modalState.currentConfig.items.find(i => i.id === itemId);
    if (item) {
        // Если пытаемся включить элемент, проверяем лимит ПЕРЕД изменением состояния
        if (enabled) {
            // Считаем количество уже включенных элементов (исключая текущий, если он был выключен)
            const currentlyEnabledCount = modalState.currentConfig.items.filter(i => i.enabled && i.id !== itemId).length;
            if (currentlyEnabledCount >= MAX_MENU_ITEMS) {
                alert(`Достигнут лимит: в радиальном меню может быть не более ${MAX_MENU_ITEMS} элементов`);
                // Отключаем чекбокс обратно
                const checkbox = document.getElementById(`item-${itemId}`);
                if (checkbox) {
                    checkbox.checked = false;
                }
                return;
            }
        }
        
        // Только после успешной проверки меняем состояние
        item.enabled = enabled;
        markAsDirty();
        updatePreview();
        validateAndEnableSave();
    }
}

// Обновление настроек
function updateSettings() {
    const radiusInput = document.getElementById('menuRadius');
    const enabledCheckbox = document.getElementById('menuEnabled');
    
    if (radiusInput) {
        modalState.currentConfig.radius = parseInt(radiusInput.value, 10) || 90;
    }
    
    if (enabledCheckbox) {
        modalState.currentConfig.enabled = enabledCheckbox.checked;
    }
}

// Обновление предпросмотра
function updatePreview() {
    updateSettings();
    
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;
    
    const config = modalState.currentConfig;
    
    if (!config.enabled) {
        previewContent.innerHTML = '<div class="preview-disabled">Меню отключено</div>';
        return;
    }
    
    // Создаем визуализацию радиального меню
    const previewHTML = createPreviewSVG(config);
    previewContent.innerHTML = previewHTML;
}

// Создание SVG превью радиального меню
function createPreviewSVG(config) {
    const enabledItems = config.items.filter(item => item.enabled);
    const itemCount = enabledItems.length;
    const centerX = 150;
    const centerY = 150;
    const radius = config.radius;
    
    let svgContent = `
<svg class="radial-menu-preview" viewBox="0 0 300 300">
    <!-- Фоновый круг -->
    <circle cx="${centerX}" cy="${centerY}" r="${radius + 40}" fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
    
    <!-- Внешнее кольцо -->
    <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="var(--vscode-accent)" stroke-width="2" stroke-dasharray="4 2"/>
    
    <!-- Центральная кнопка -->
    <circle cx="${centerX}" cy="${centerY}" r="25" fill="var(--modal-header-bg)" stroke="var(--modal-border)" stroke-width="1"/>
    <text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-size="20" fill="var(--modal-text-muted)">✕</text>
`;
    
    if (itemCount > 0) {
        const angleStep = (2 * Math.PI) / itemCount;
        
        enabledItems.forEach((item, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            svgContent += `
    <!-- Элемент ${item.label} -->
    <g transform="translate(${x}, ${y}) translate(-8, -8)">
        <rect width="16" height="16" fill="var(--modal-bg)" rx="2"/>
        <svg x="3" y="3" width="10" height="10" viewBox="0 0 16 16">
            <use href="#${item.icon}" style = "fill:var(--text-primary);"/>
        </svg>
    </g>
    
    <!-- Подпись -->
    <text x="${x}" y="${y + 25}" text-anchor="middle" font-size="9" fill="var(--modal-text-muted)" style="pointer-events:none;">${item.label}</text>
`;
        });
    } else {
        svgContent += `
    <text x="${centerX}" y="${centerY + 60}" text-anchor="middle" font-size="12" fill="var(--modal-text-muted)">Нет активных элементов</text>
`;
    }
    
    svgContent += '</svg>';
    return svgContent;
}

// Открытие модального окна конфигурации
function openRadialMenuConfigModal(existingConfig = null) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('radialMenuConfigModal');
        if (!modal) {
            reject(new Error('Модальное окно не найдено'));
            return;
        }
        
        // Сохраняем промисы для разрешения позже
        modalState.resolvePromise = resolve;
        modalState.rejectPromise = reject;
        
        // Инициализация состояния
        modalState.isOpen = true;
        modalState.isDirty = false;
        modalState.validationErrors = [];
        
        // Загрузка конфигурации из радиального меню если не передана
        if (existingConfig) {
            modalState.originalConfig = JSON.parse(JSON.stringify(existingConfig));
            modalState.currentConfig = JSON.parse(JSON.stringify(existingConfig));
        } else {
            // Получаем текущую конфигурацию из радиального меню
            const currentRadialConfig = window.radialMenu && window.radialMenu.getConfig ? 
                window.radialMenu.getConfig() : null;
                
            if (currentRadialConfig) {
                modalState.originalConfig = JSON.parse(JSON.stringify(currentRadialConfig));
                modalState.currentConfig = JSON.parse(JSON.stringify(currentRadialConfig));
            } else {
                // Новая конфигурация по умолчанию
                modalState.originalConfig = {
                    enabled: true,
                    radius: 90,
                    items: [...defaultTools, ...defaultFilters]
                };
                modalState.currentConfig = JSON.parse(JSON.stringify(modalState.originalConfig));
            }
        }
        
        // Заполнение формы
        populateForm();
        
        // Обновление превью
        updatePreview();
        
        // Обновление индикаторов
        updateDirtyIndicator();
        validateAndEnableSave();
        
        // Показ модалки
        modal.classList.add('active');
        
        // Поднятие на передний план
        bringToFront(modal);
    });
}

// Заполнение формы данными
function populateForm() {
    const config = modalState.currentConfig;
    
    // Настройки
    const radiusInput = document.getElementById('menuRadius');
    const enabledCheckbox = document.getElementById('menuEnabled');
    
    if (radiusInput) radiusInput.value = config.radius;
    if (enabledCheckbox) enabledCheckbox.checked = config.enabled;
    
    // Списки инструментов и фильтров
    renderToolsList();
    renderFiltersList();
}

// Закрытие модального окна конфигурации
function closeRadialMenuConfigModal() {
    if (modalState.isDirty) {
        const confirmed = confirm('У вас есть несохраненные изменения. Закрыть без сохранения?');
        if (!confirmed) return;
    }
    
    const modal = document.getElementById('radialMenuConfigModal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Отклоняем промис (отмена изменений)
    if (modalState.rejectPromise) {
        modalState.rejectPromise(new Error('Изменения отменены'));
    }
    
    // Сбрасываем промисы
    modalState.resolvePromise = null;
    modalState.rejectPromise = null;
    
    modalState.isOpen = false;
    modalState.isDirty = false;
    modalState.originalConfig = null;
    modalState.currentConfig = null;
}

// Сохранение конфигурации из модального окна
function saveRadialMenuConfigFromModal() {
    const errors = validateConfig();
    if (errors.length > 0) {
        alert('Ошибка валидации:\n' + errors.join('\n'));
        return;
    }
    
    // Применяем конфигурацию к радиальному меню
    if (window.radialMenu && window.radialMenu.setConfig) {
        window.radialMenu.setConfig(modalState.currentConfig);
    }
    
    // Сохраняем в localStorage
    if (window.radialMenu && window.radialMenu.saveConfig) {
        window.radialMenu.saveConfig();
    }
    
    // Разрешаем промис с новой конфигурацией
    if (modalState.resolvePromise) {
        modalState.resolvePromise(JSON.parse(JSON.stringify(modalState.currentConfig)));
    }
    
    // Закрываем окно
    closeRadialMenuConfigModal();
    
    console.log('✅ Конфигурация радиального меню сохранена');
}

// Поднятие окна на передний план
function bringToFront(modal) {
    const activeModals = Array.from(document.querySelectorAll('.modal.active'));
    const maxZ = activeModals.reduce((max, m) => {
        const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
        return Math.max(max, z);
    }, 0);
    modal.style.zIndex = maxZ + 1;
}

// Показать модальное окно настройки радиального меню (старая функция, теперь вызывает новую)
function showRadialMenuSettings() {
    initRadialMenuConfigModal();
    openRadialMenuConfigModal();
}

// Закрыть модальное окно настройки (устаревшая функция)
function closeRadialMenuSettingsModal() {
    closeRadialMenuConfigModal();
}

// Сохранение настроек радиального меню (устаревшая функция)
function saveRadialMenuSettings() {
    saveRadialMenuConfigFromModal();
}

// Сохранение конфигурации в localStorage
function saveRadialMenuConfig() {
    localStorage.setItem('radialMenuConfig', JSON.stringify(radialMenuConfig));
}

// Загрузка конфигурации из localStorage
function loadRadialMenuConfig() {
    const saved = localStorage.getItem('radialMenuConfig');
    if (saved) {
        try {
            const loadedConfig = JSON.parse(saved);
            // Объединяем с конфигом по умолчанию
            radialMenuConfig = {
                ...radialMenuConfig,
                ...loadedConfig,
                items: radialMenuConfig.items.map(item => {
                    const loadedItem = loadedConfig.items?.find(i => i.id === item.id);
                    return loadedItem ? { ...item, enabled: loadedItem.enabled } : item;
                })
            };
        } catch (e) {
            console.error('Ошибка загрузки конфигурации радиального меню:', e);
        }
    }
}

// Экспорт функций
window.radialMenu = {
    show: showRadialMenu,
    hide: hideRadialMenu,
    toggle: (x, y) => radialMenuVisible ? hideRadialMenu() : showRadialMenu(x, y),
    getConfig: () => radialMenuConfig,
    setConfig: (config) => {
        radialMenuConfig = { ...radialMenuConfig, ...config };
        saveRadialMenuConfig();
        // Перерисовываем меню если оно открыто
        if (radialMenuElement && radialMenuVisible) {
            renderRadialMenuItems(radialMenuElement);
        }
    },
    saveConfig: saveRadialMenuConfig,
    loadConfig: loadRadialMenuConfig,
    openConfigModal: openRadialMenuConfigModal,
    closeConfigModal: closeRadialMenuConfigModal
};

// Экспортируем функции напрямую для использования в других модулях
window.showRadialMenu = showRadialMenu;
window.hideRadialMenu = hideRadialMenu;
window.handleCanvasContextMenu = handleCanvasContextMenu;
window.handleRadialMenuMouseMove = handleRadialMenuMouseMove;
window.showRadialMenuSettings = showRadialMenuSettings;
window.closeRadialMenuSettingsModal = closeRadialMenuSettingsModal;
window.saveRadialMenuSettings = saveRadialMenuSettings;
window.closeRadialMenuConfigModal = closeRadialMenuConfigModal;
window.saveRadialMenuConfigFromModal = saveRadialMenuConfigFromModal;

// Автозагрузка конфигурации и инициализация модального окна
loadRadialMenuConfig();
initRadialMenuConfigModal();