/* Радиальное контекстное меню для canvas */

// Конфигурация меню по умолчанию
let radialMenuConfig = {
    enabled: true,
    radius: 80,
    items: [
        { id: 'undo', icon: 'icon-undo', label: 'Отменить', action: 'undo', enabled: true },
        { id: 'redo', icon: 'icon-redo', label: 'Повторить', action: 'redo', enabled: true },
        { id: 'copy', icon: 'icon-copy', label: 'Копировать', action: 'copy', enabled: true },
        { id: 'paste', icon: 'icon-paste', label: 'Вставить', action: 'paste', enabled: true },
        { id: 'cut', icon: 'icon-cut', label: 'Вырезать', action: 'cut', enabled: true },
        { id: 'zoom-in', icon: 'icon-zoom-in', label: 'Увеличить', action: 'zoomIn', enabled: true },
        { id: 'zoom-out', icon: 'icon-zoom-out', label: 'Уменьшить', action: 'zoomOut', enabled: true },
        { id: 'rotate', icon: 'rotate-cw', label: 'Повернуть', action: 'rotate', enabled: true }
    ]
};

// Состояние меню
let radialMenuVisible = false;
let radialMenuElement = null;

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

    const enabledItems = radialMenuConfig.items.filter(i => i.enabled);
    const count = enabledItems.length;
    const angleStep = count > 0 ? (2 * Math.PI) / count : 0;
    const radius = radialMenuConfig.radius;

    enabledItems.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'radial-menu-item';
        btn.dataset.action = item.action;
        btn.title = item.label;
        
        const icon = document.createElement('svg');
        icon.className = 'tool-icon';
        icon.innerHTML = `<use href="#${item.icon}"></use>`;
        
        const label = document.createElement('span');
        label.className = 'radial-menu-label';
        label.textContent = item.label;
        
        btn.appendChild(icon);
        btn.appendChild(label);
        
        // Вычисляем позицию для элемента меню
        const angle = index * angleStep - Math.PI / 2; // Начинаем сверху
        const itemX = Math.cos(angle) * radius;
        const itemY = Math.sin(angle) * radius;
        
        btn.style.left = `${itemX}px`;
        btn.style.top = `${itemY}px`;
        
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

    radialMenuVisible = true;
}

// Скрытие меню
function hideRadialMenu() {
    if (radialMenuElement) {
        radialMenuElement.style.display = 'none';
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
    
    // Проверяем, что клик был по активному canvas
    if (e.target !== file.canvas) return;
    
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

// Автозагрузка конфигурации
loadRadialMenuConfig();
