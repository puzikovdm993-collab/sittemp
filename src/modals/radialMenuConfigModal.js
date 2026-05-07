/* radialMenuConfigModal.js - Модальное окно конфигурации радиального меню */

(function() {
    'use strict';

    // Состояние модального окна
    let modalState = {
        isOpen: false,
        isDirty: false,
        originalConfig: null,
        currentConfig: null,
        validationErrors: [],
        resolvePromise: null,
        rejectPromise: null
    };

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

    // Инициализация модального окна
    function initRadialMenuConfigModal() {
        // Создаем HTML модалки если её нет
        createModalHTML();
        
        // Навешиваем обработчики событий
        attachEventListeners();
        
        console.log('✅ Модальное окно конфигурации радиального меню инициализировано');
    }

    // Создание HTML структуры модального окна
    function createModalHTML() {
        if (document.getElementById('radialMenuConfigModal')) return;

        const modalHTML = `
<div class="modal" id="radialMenuConfigModal">
    <div class="modal-content radial-menu-config-modal">
        <div class="modal-title">
            <span>Конфигурация радиального меню</span>
            <button onclick="window.radialMenuConfigModal.cancel()">✕</button>
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
                <div class="panel-section settings-section">
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
                <div class="preview-header">
                    <span>👁️ Предпросмотр</span>
                    <span class="preview-status" id="previewStatus">Активно</span>
                </div>
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
                <button class="btn btn-cancel" onclick="window.radialMenuConfigModal.cancel()">Отменить</button>
                <button class="btn btn-save" id="saveButton" onclick="window.radialMenuConfigModal.save()" disabled>Сохранить</button>
            </div>
        </div>
        <div class="modal-resize-handle"></div>
    </div>
</div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Привязка обработчиков событий
    function attachEventListeners() {
        const modal = document.getElementById('radialMenuConfigModal');
        if (!modal) return;

        // Обработчик закрытия по ESC
        document.addEventListener('keydown', handleKeyDown);
        
        // Обработчик клика вне области окна
        modal.addEventListener('mousedown', handleOutsideClick);
        
        // Обработчики изменений в полях ввода
        const inputs = modal.querySelectorAll('input[type="number"], input[type="checkbox"]');
        inputs.forEach(input => {
            input.addEventListener('change', handleInputChange);
            input.addEventListener('input', handleInputChange);
        });
    }

    // Обработчик нажатия клавиш
    function handleKeyDown(e) {
        if (!modalState.isOpen) return;
        
        if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    }

    // Обработчик клика вне области окна
    function handleOutsideClick(e) {
        if (!modalState.isOpen) return;
        
        const modalContent = document.querySelector('.radial-menu-config-modal');
        if (modalContent && !modalContent.contains(e.target)) {
            cancel();
        }
    }

    // Обработчик изменений в полях ввода
    function handleInputChange() {
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
        
        const hasEnabledItems = modalState.currentConfig.items.some(item => item.enabled);
        const isValid = errors.length === 0 && hasEnabledItems;
        
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
        icon.innerHTML = `<use href="#${item.icon}"></use>`;
        
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
                
                // Сегмент
                const startAngle = angle - angleStep / 2;
                const endAngle = angle + angleStep / 2;
                
                const x1 = centerX + (radius - 20) * Math.cos(startAngle);
                const y1 = centerY + (radius - 20) * Math.sin(startAngle);
                const x2 = centerX + radius * Math.cos(startAngle);
                const y2 = centerY + radius * Math.sin(startAngle);
                const x3 = centerX + radius * Math.cos(endAngle);
                const y3 = centerY + radius * Math.sin(endAngle);
                const x4 = centerX + (radius - 20) * Math.cos(endAngle);
                const y4 = centerY + (radius - 20) * Math.sin(endAngle);
                
                svgContent += `
    <!-- Сегмент ${item.label} -->
    <path d="M${x1},${y1} L${x2},${y2} A${radius},${radius} 0 0,1 ${x3},${y3} L${x4},${y4} A${radius-20},${radius-20} 0 0,0 ${x1},${y1} Z" 
          fill="var(--vscode-accent)" opacity="0.3" stroke="var(--modal-border)" stroke-width="1"/>
    
    <!-- Иконка -->
    <g transform="translate(${x}, ${y}) translate(-8, -8)">
        <rect width="16" height="16" fill="var(--modal-bg)" rx="2"/>
        <text x="8" y="12" text-anchor="middle" font-size="10" fill="var(--modal-text)">📷</text>
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

    // Открытие модального окна
    function open(existingConfig = null) {
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

    // Закрытие модального окна
    function close() {
        const modal = document.getElementById('radialMenuConfigModal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        // Сбрасываем промисы
        modalState.resolvePromise = null;
        modalState.rejectPromise = null;
        
        modalState.isOpen = false;
        modalState.isDirty = false;
        modalState.originalConfig = null;
        modalState.currentConfig = null;
    }

    // Сохранение конфигурации
    function save() {
        const errors = validateConfig();
        if (errors.length > 0) {
            alert('Ошибка валидации:\n' + errors.join('\n'));
            return;
        }
        
        const hasEnabledItems = modalState.currentConfig.items.some(item => item.enabled);
        if (!hasEnabledItems) {
            alert('Выберите хотя бы один элемент для отображения в меню');
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
        close();
        
        console.log('✅ Конфигурация радиального меню сохранена');
    }

    // Отмена изменений
    function cancel() {
        if (modalState.isDirty) {
            const confirmed = confirm('У вас есть несохраненные изменения. Закрыть без сохранения?');
            if (!confirmed) return;
        }
        
        // Отклоняем промис (отмена изменений)
        if (modalState.rejectPromise) {
            modalState.rejectPromise(new Error('Изменения отменены'));
        }
        
        close();
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

    // Экспорт публичных функций
    window.radialMenuConfigModal = {
        open: open,
        close: close,
        save: save,
        cancel: cancel,
        getState: () => modalState,
        getConfig: () => modalState.currentConfig
    };

    // Автоинициализация при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRadialMenuConfigModal);
    } else {
        initRadialMenuConfigModal();
    }
})();
