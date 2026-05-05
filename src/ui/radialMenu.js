/* Радиальное контекстное меню для canvas */

// Конфигурация меню по умолчанию
let radialMenuConfig = {
    enabled: true,
    radius: 90,
    items: [
        { id: 'undo', icon: 'icon-undo', label: 'Отменить', action: 'undo', enabled: true, row: 1 },
        { id: 'redo', icon: 'icon-redo', label: 'Повторить', action: 'redo', enabled: true, row: 1 },
        { id: 'copy', icon: 'icon-copy', label: 'Копировать', action: 'copy', enabled: true, row: 1 },
        { id: 'paste', icon: 'icon-paste', label: 'Вставить', action: 'paste', enabled: true, row: 1 },
        { id: 'cut', icon: 'icon-cut', label: 'Вырезать', action: 'cut', enabled: true, row: 2 },
        { id: 'zoom-in', icon: 'icon-zoom-in', label: 'Увеличить', action: 'zoomIn', enabled: true, row: 2 },
        { id: 'zoom-out', icon: 'icon-zoom-out', label: 'Уменьшить', action: 'zoomOut', enabled: true, row: 2 },
        { id: 'rotate', icon: 'icon-rotate-right', label: 'Повернуть', action: 'rotate', enabled: true, row: 2 }
    ]
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
    const menuBoundary = radialMenuConfig.radius + 40 + 10;
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
    centerBtn.innerHTML = '<svg class="icon"><use href="#icon-close"></use></svg>';
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
    
    // Разделяем элементы по рядам
    const row1Items = radialMenuConfig.items.filter(i => i.enabled && i.row === 1);
    const row2Items = radialMenuConfig.items.filter(i => i.enabled && i.row === 2);
    
    const row1Count = row1Items.length;
    const row2Count = row2Items.length;
    
    const row1AngleStep = row1Count > 0 ? (2 * Math.PI) / row1Count : 0;
    const row2AngleStep = row2Count > 0 ? (2 * Math.PI) / row2Count : 0;
    
    // Смещение для второго ряда (на половину шага, чтобы элементы были в шахматном порядке)
    const row2Offset = row2Count > 0 ? row2AngleStep / 2 : 0;

    // Отрисовка элементов первого ряда
    row1Items.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'radial-menu-item';
        btn.dataset.action = item.action;
        btn.title = item.label;
        
        // Создаем контейнер для содержимого
        const content = document.createElement('div');
        content.className = 'item-content';
        
        const icon = document.createElement('svg');
        icon.className = 'tool-icon';
        icon.innerHTML = `<use href="#${item.icon}"></use>`;
        
        const label = document.createElement('span');
        label.className = 'radial-menu-label';
        label.textContent = item.label;
        
        content.appendChild(icon);
        content.appendChild(label);
        btn.appendChild(content);
        
        // Вычисляем угол для элемента меню первого ряда
        const angle = index * row1AngleStep - Math.PI / 2; // Начинаем сверху
        
        // Поворачиваем сегмент вокруг центра
        const rotation = angle * (180 / Math.PI); // Конвертируем в градусы
        btn.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            handleRadialMenuAction(item.action);
            hideRadialMenu();
        };
        
        menu.appendChild(btn);
    });
    
    // Отрисовка элементов второго ряда
    row2Items.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'radial-menu-item row-2';
        btn.dataset.action = item.action;
        btn.title = item.label;
        
        // Создаем контейнер для содержимого
        const content = document.createElement('div');
        content.className = 'item-content';
        
        const icon = document.createElement('svg');
        icon.className = 'tool-icon';
        icon.innerHTML = `<use href="#${item.icon}"></use>`;
        
        const label = document.createElement('span');
        label.className = 'radial-menu-label';
        label.textContent = item.label;
        
        content.appendChild(icon);
        content.appendChild(label);
        btn.appendChild(content);
        
        // Вычисляем угол для элемента меню второго ряда со смещением
        const angle = index * row2AngleStep + row2Offset - Math.PI / 2; // Начинаем сверху со смещением
        
        // Поворачиваем сегмент вокруг центра
        const rotation = angle * (180 / Math.PI); // Конвертируем в градусы
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

// Показать модальное окно настройки радиального меню
function showRadialMenuSettings() {
    const modal = document.getElementById('radialMenuSettingsModal');
    const container = document.getElementById('radialMenuItemsContainer');
    const radiusInput = document.getElementById('radialMenuRadius');
    
    if (!modal || !container) return;
    
    // Заполняем список элементов
    container.innerHTML = '';
    radialMenuConfig.items.forEach((item, index) => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = 'display: flex; align-items: center; gap: 5px; padding: 5px 10px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `menu-item-${index}`;
        checkbox.checked = item.enabled;
        checkbox.onchange = () => {
            item.enabled = checkbox.checked;
        };
        
        const label = document.createElement('label');
        label.htmlFor = `menu-item-${index}`;
        label.textContent = item.label;
        label.style.cursor = 'pointer';
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        container.appendChild(checkboxContainer);
    });
    
    // Устанавливаем текущий радиус
    radiusInput.value = radialMenuConfig.radius;
    
    modal.classList.add('active');
}

// Закрыть модальное окно настройки
function closeRadialMenuSettingsModal() {
    const modal = document.getElementById('radialMenuSettingsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Сохранение настроек радиального меню
function saveRadialMenuSettings() {
    const radiusInput = document.getElementById('radialMenuRadius');
    if (radiusInput) {
        radialMenuConfig.radius = parseInt(radiusInput.value, 10) || 80;
    }
    
    saveRadialMenuConfig();
    closeRadialMenuSettingsModal();
    
    // Перерисовываем меню с новыми настройками
    if (radialMenuElement) {
        renderRadialMenuItems(radialMenuElement);
    }
    
    alert('Настройки радиального меню сохранены!');
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
    },
    saveConfig: saveRadialMenuConfig,
    loadConfig: loadRadialMenuConfig
};

// Экспортируем функции напрямую для использования в других модулях
window.showRadialMenu = showRadialMenu;
window.hideRadialMenu = hideRadialMenu;
window.handleCanvasContextMenu = handleCanvasContextMenu;
window.handleRadialMenuMouseMove = handleRadialMenuMouseMove;

// Автозагрузка конфигурации
loadRadialMenuConfig();
