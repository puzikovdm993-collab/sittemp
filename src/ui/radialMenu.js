/* Радиальное контекстное меню для canvas */

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
        { id: 'rotate', icon: 'icon-rotate-right', label: 'Повернуть', action: 'rotate', enabled: true }
    ]
};

// Состояние меню
let radialMenuVisible = false;
let radialMenuElement = null;
let radialMenuCenterX = 0;
let radialMenuCenterY = 0;
let rightMouseDown = false;
let selectedItem = null;

// Обработчик движения мыши для скрытия меню при выходе за пределы и подсветки элементов
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
        selectedItem = null;
        clearAllItemHighlights();
        return;
    }
    
    // Определяем, над каким элементом находится курсор
    const angle = Math.atan2(e.clientY - radialMenuCenterY, e.clientX - radialMenuCenterX);
    let normalizedAngle = angle * (180 / Math.PI) + 90; // Поворачиваем чтобы 0 был сверху
    if (normalizedAngle < 0) normalizedAngle += 360;
    
    const allItems = radialMenuConfig.items.filter(i => i.enabled);
    const itemCount = allItems.length;
    const angleStep = 360 / itemCount;
    
    const itemIndex = Math.floor(normalizedAngle / angleStep);
    const hoveredItem = allItems[itemIndex];
    
    if (hoveredItem && hoveredItem !== selectedItem) {
        selectedItem = hoveredItem;
        highlightItem(hoveredItem);
    }
}

// Подсветка элемента меню
function highlightItem(item) {
    clearAllItemHighlights();
    const btn = radialMenuElement.querySelector(`[data-action="${item.action}"]`);
    if (btn) {
        btn.classList.add('highlighted');
    }
}

// Очистка всех подсветок
function clearAllItemHighlights() {
    const items = radialMenuElement.querySelectorAll('.radial-menu-item');
    items.forEach(item => item.classList.remove('highlighted'));
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
    
    // Получаем все активные элементы
    const allItems = radialMenuConfig.items.filter(i => i.enabled);
    const itemCount = allItems.length;
    
    const angleStep = itemCount > 0 ? (2 * Math.PI) / itemCount : 0;

    // Отрисовка всех элементов в одном ряду
    allItems.forEach((item, index) => {
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
        
        // Вычисляем угол для элемента меню
        const angle = index * angleStep - Math.PI / 2; // Начинаем сверху
        
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

// Обработчик контекстного меню на canvas - теперь только предотвращает стандартное меню
function handleCanvasContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
}

// Глобальный обработчик для предотвращения контекстного меню браузера при любом правом клике
document.addEventListener('contextmenu', function(e) {
    // Всегда предотвращаем контекстное меню браузера если зажата правая кнопка и есть активное радиальное меню
    if (radialMenuVisible || rightMouseDown) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}, true);

// Показ меню при зажатии правой кнопки мыши
function showRadialMenuOnMouseDown(x, y) {
    if (!radialMenuConfig.enabled) return;
    
    rightMouseDown = true;
    selectedItem = null;
    
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

// Скрытие меню и выполнение действия при отпускании правой кнопки
function hideRadialMenuOnMouseUp() {
    if (!rightMouseDown || !radialMenuVisible) return;
    
    // Выполняем действие для выбранного элемента
    if (selectedItem) {
        handleRadialMenuAction(selectedItem.action);
    }
    
    rightMouseDown = false;
    
    // Скрываем меню
    if (radialMenuElement) {
        radialMenuElement.style.display = 'none';
        radialMenuElement.classList.remove('active');
    }
    radialMenuVisible = false;
    selectedItem = null;
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
    show: showRadialMenuOnMouseDown,
    hide: hideRadialMenu,
    toggle: (x, y) => radialMenuVisible ? hideRadialMenu() : showRadialMenuOnMouseDown(x, y),
    getConfig: () => radialMenuConfig,
    setConfig: (config) => {
        radialMenuConfig = { ...radialMenuConfig, ...config };
        saveRadialMenuConfig();
    },
    saveConfig: saveRadialMenuConfig,
    loadConfig: loadRadialMenuConfig
};

// Экспортируем функции напрямую для использования в других модулях
window.showRadialMenu = showRadialMenuOnMouseDown;
window.hideRadialMenu = hideRadialMenu;
window.handleCanvasContextMenu = handleCanvasContextMenu;
window.handleRadialMenuMouseMove = handleRadialMenuMouseMove;
window.showRadialMenuOnMouseDown = showRadialMenuOnMouseDown;
window.hideRadialMenuOnMouseUp = hideRadialMenuOnMouseUp;
window.handleRadialMenuMouseDown = handleRadialMenuMouseDown;
window.handleRadialMenuMouseUp = handleRadialMenuMouseUp;

// Обработчики для радиального меню на правую кнопку мыши
function handleRadialMenuMouseDown(e) {
    // Проверяем, что это правая кнопка мыши (button 2)
    if (e.button !== 2) return;
    
    e.preventDefault();
    showRadialMenuOnMouseDown(e.clientX, e.clientY);
}

function handleRadialMenuMouseUp(e) {
    // Проверяем, что это правая кнопка мыши (button 2)
    if (e.button !== 2) return;
    
    e.preventDefault();
    hideRadialMenuOnMouseUp();
}

// Автозагрузка конфигурации
loadRadialMenuConfig();
