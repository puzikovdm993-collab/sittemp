// modals.js – окончательная версия с поддержкой поднятия окон
(function() {
    'use strict';

    // const MIN_WIDTH = 300;
    // const MIN_HEIGHT = 200;

    const MODAL_MIN_SIZES = {
        graphModal: { width: 400, height: 300 },  // Минимальные размеры для graphModal
        default: { width: 300, height: 200 }      // Общие значения по умолчанию
    };
    const STORAGE_PREFIX = 'modal_';

    // Функция поднятия окна на передний план
    function bringToFront(modal) {
        const activeModals = Array.from(document.querySelectorAll('.modal.active'));
        const maxZ = activeModals.reduce((max, m) => {
            const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
            return Math.max(max, z);
        }, 0);
        modal.style.zIndex = maxZ + 1;
    }

    function initModal(modal) {
        const content = modal.querySelector('.modal-content');
        const title = modal.querySelector('.modal-title');
        const resizeHandle = modal.querySelector('.modal-resize-handle');
        const closeBtn = modal.querySelector('.modal-title button');

        if (!content || !title) return;

        // ---- Сохранение состояния ----
        function saveModalState() {
            if (!modal.id) return;
            const left = content.style.left ? parseInt(content.style.left) : null;
            const top = content.style.top ? parseInt(content.style.top) : null;
            const width = content.style.width ? parseInt(content.style.width) : null;
            const height = content.style.height ? parseInt(content.style.height) : null;
            if (left !== null && top !== null && width !== null && height !== null) {
                const state = { left, top, width, height };
                localStorage.setItem(STORAGE_PREFIX + modal.id, JSON.stringify(state));
            }
        }

        // ---- Восстановление состояния (синхронно) ----
        function restoreModalState() {
            if (!modal.id) return;
            const saved = localStorage.getItem(STORAGE_PREFIX + modal.id);
            if (!saved) return;
            try {
                const state = JSON.parse(saved);

                // Применяем размеры

                if (state.width){ 
                    content.style.width = Math.max(
                        MODAL_MIN_SIZES[modal.id]?.width || MODAL_MIN_SIZES.default.width,
                        content.offsetWidth 
                    );
                }
                if (state.height) {
                    content.style.height = Math.max(
                        MODAL_MIN_SIZES[modal.id]?.height || MODAL_MIN_SIZES.default.height,
                        content.offsetHeight 
                    );
                }

                // Принудительный reflow, чтобы браузер сразу пересчитал размеры
                content.offsetHeight;

                const currentWidth = content.offsetWidth;
                const currentHeight = content.offsetHeight;
                const maxX = window.innerWidth - currentWidth;
                const maxY = window.innerHeight - currentHeight;

                let newLeft = state.left;
                let newTop = state.top;
                if (newLeft !== undefined) newLeft = Math.max(0, Math.min(newLeft, maxX));
                if (newTop !== undefined) newTop = Math.max(0, Math.min(newTop, maxY));

                content.style.left = newLeft + 'px';
                content.style.top = newTop + 'px';

                // Для окна с графиком обновляем Plotly
                if (modal.id === 'graphModal') {
                    resizePlotlyGraph();
                }
            } catch (e) {
                console.warn('Ошибка восстановления модального окна', e);
            }
        }

        // Наблюдатель за появлением класса active
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (modal.classList.contains('active')) {
                        restoreModalState();
                        // Поднимаем окно при активации
                        bringToFront(modal);
                    }
                }
            });
        });
        observer.observe(modal, { attributes: true });

        // Если окно уже активно при загрузке (маловероятно)
        if (modal.classList.contains('active')) {
            restoreModalState();
            bringToFront(modal);
        }

        // Закрытие по крестику
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modal.classList.remove('active');
            });
        }

        // Поднятие окна при клике на него (если активно)
        modal.addEventListener('mousedown', () => {
            if (modal.classList.contains('active')) {
                bringToFront(modal);
            }
        });

        // ---- Перетаскивание ----
        let isDragging = false;
        let dragOffsetX, dragOffsetY;

        title.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            dragOffsetX = e.clientX - content.offsetLeft;
            dragOffsetY = e.clientY - content.offsetTop;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const newX = e.clientX - dragOffsetX;
            const newY = e.clientY - dragOffsetY;

            const maxX = window.innerWidth - content.offsetWidth;
            const maxY = window.innerHeight - content.offsetHeight;
            const clampedX = Math.max(0, Math.min(newX, maxX));
            const clampedY = Math.max(0, Math.min(newY, maxY));

            content.style.left = clampedX + 'px';
            content.style.top = clampedY + 'px';
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                saveModalState();
            }
        });

        // ---- Изменение размера (если есть ручка) ----
        if (resizeHandle) {
            let isResizing = false;
            let startWidth, startHeight, startX, startY;

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startWidth = content.offsetWidth;
                startHeight = content.offsetHeight;
                startX = e.clientX;
                startY = e.clientY;
                e.preventDefault();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;



                // Получаем текущие startWidth/startHeight (из кода, который запускает resize)
                const newWidth = Math.max(
                    MODAL_MIN_SIZES[modal.id]?.width || MODAL_MIN_SIZES.default.width,
                    startWidth + dx
                );
                const newHeight = Math.max(
                    MODAL_MIN_SIZES[modal.id]?.height || MODAL_MIN_SIZES.default.height,
                    startHeight + dy
                );

                // const newWidth = Math.max(MIN_WIDTH, startWidth + dx);
                // const newHeight = Math.max(MIN_HEIGHT, startHeight + dy);

                content.style.width = newWidth + 'px';
                content.style.height = newHeight + 'px';

                if (modal.id === 'graphModal') {
                    throttleResizePlotly();
                }
            });

            window.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    if (modal.id === 'graphModal') {
                        resizePlotlyGraph();
                    }
                    saveModalState();
                }
            });
        }
    }

    // Инициализация всех модальных окон
    document.querySelectorAll('.modal').forEach(initModal);

    // ---- Логика для графика Plotly ----
    const graphContainer = document.querySelector('#graphCanvas')?.parentNode;

    function resizePlotlyGraph() {
        if (!graphContainer || typeof Plotly === 'undefined') return;
        const rect = graphContainer.getBoundingClientRect();
        const style = window.getComputedStyle(graphContainer);
        const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

        const width = Math.max(100, rect.width - padX - borderX);
        const height = Math.max(100, rect.height - padY - borderY);

        Plotly.relayout('graphCanvas', { width, height });
    }

    let throttleTimer = null;
    function throttleResizePlotly() {
        if (throttleTimer) return;
        throttleTimer = setTimeout(() => {
            resizePlotlyGraph();
            throttleTimer = null;
        }, 100);
    }

    // Наблюдатель за изменениями размеров контейнера графика
    if (graphContainer && window.ResizeObserver) {
        const observer = new ResizeObserver(() => resizePlotlyGraph());
        observer.observe(graphContainer);
    }

    window.addEventListener('load', () => {
        if (graphContainer) resizePlotlyGraph();
    });

    console.log('✅ modals.js загружен (финальная версия с поднятием окон)');

    // ====================== ИСТОРИЯ ИЗМЕНЕНИЙ (глобальные функции) ======================

    let selectedHistoryIndex = -1;
    let restoreTimer = null;
    let originalHistoryIndex = -1;

    // Показать окно истории
    window.showHistoryModal = function() {
        const modal = document.getElementById('historyModal');
        if (!modal) return console.error('historyModal не найден');

        const file = getActiveFile();
        if (file) originalHistoryIndex = file.historyIndex;

        modal.classList.add('active');
        updateHistoryModal();
    };

    // Закрыть окно
    window.closeHistoryModal = function() {
        const modal = document.getElementById('historyModal');
        if (modal) modal.classList.remove('active');

        // Возвращаем оригинальное состояние при закрытии
        const file = getActiveFile();
        if (file && originalHistoryIndex !== -1 && originalHistoryIndex !== file.historyIndex) {
            jumpToHistoryState(originalHistoryIndex, false);
        }
        originalHistoryIndex = -1;
        selectedHistoryIndex = -1;
    };

    // Обновление всего окна
    function updateHistoryModal() {
        const file = getActiveFile();
        if (!file) return;

        // Статистика
        document.getElementById('totalActionsCount').textContent = file.history.length;
        document.getElementById('currentActionPosition').textContent = file.historyIndex + 1;

        // Слайдер
        const slider = document.getElementById('historySlider');
        if (slider) {
            slider.max = Math.max(0, file.history.length - 1);
            slider.value = file.historyIndex;
        }

        updateHistoryList();
        updateHistoryMarkers();
    }

    // Список действий
    function updateHistoryList() {
        const file = getActiveFile();
        if (!file) return;
        const ul = document.getElementById('historyListBody');
        if (!ul) return;

        ul.innerHTML = '';

        if (file.history.length === 0) {
            const li = document.createElement('li');
            li.style.cssText = 'padding:15px;text-align:center;color:#666';
            li.textContent = 'Нет действий в истории';
            ul.appendChild(li);
            return;
        }

        for (let i = 0; i < file.history.length; i++) {
            const state = file.history[i];
            const isCurrent = i === file.historyIndex;
            const name = (typeof getActionName === 'function' ? getActionName(state) : null) || `Действие ${i+1}`;

            const li = document.createElement('li');
            li.style.cssText = `
                display:flex; align-items:center; padding:10px; border-bottom:1px solid #eee;
                cursor:pointer; transition:background .2s;
                ${isCurrent ? 'background:#e3f2fd;font-weight:bold' : ''}
            `;
            li.innerHTML = `
                <span style="width:30px;text-align:center">${i+1}</span>
                <span style="flex:1;display:flex;align-items:center;gap:6px">
                    <span>${(typeof getActionIcon === 'function' ? getActionIcon(state) : '📄')}</span>
                    ${name}
                </span>
                <span style="color:#666;font-size:0.9em">
                    ${state.timestamp ? (typeof formatTimestamp === 'function' ? formatTimestamp(state.timestamp) : new Date(state.timestamp).toLocaleTimeString('ru-RU')) : '—'}
                </span>
            `;

            li.onclick = () => {
                temporaryRestore(i);
                selectedHistoryIndex = i;
                // подсветка
                Array.from(ul.children).forEach((el, idx) => {
                    el.style.background = idx === i ? '#f0f8ff' : '';
                    el.style.fontWeight = idx === i ? 'bold' : '';
                });
                const s = document.getElementById('historySlider');
                if (s) s.value = i;
            };

            li.ondblclick = () => jumpToHistoryState(i);
            ul.appendChild(li);
        }
    }

    // Маркеры на слайдере
    function updateHistoryMarkers() {
        const file = getActiveFile();
        if (!file || file.history.length <= 1) return;
        const cont = document.querySelector('.history-markers');
        if (!cont) return;
        cont.innerHTML = '';
        for (let i = 0; i < file.history.length; i++) {
            const m = document.createElement('div');
            m.style.cssText = `position:absolute;width:2px;height:8px;background:${i===file.historyIndex?'#4CAF50':'#999'};
                left:${(i/(file.history.length-1))*100}%;bottom:0;transform:translateX(-50%)`;
            cont.appendChild(m);
        }
    }

    // Временный предпросмотр (oninput слайдера)
    function temporaryRestore(index) {
        const file = getActiveFile();
        if (!file || !file.history[index]) return;
        restoreState(file, file.history[index]);   // функция уже есть в index.js
    }

    window.debounceTemporaryRestore = function(value) {
        if (restoreTimer) clearTimeout(restoreTimer);
        restoreTimer = setTimeout(() => {
            temporaryRestore(parseInt(value));
            selectedHistoryIndex = parseInt(value);
            const ul = document.getElementById('historyListBody');
            if (ul) {
                Array.from(ul.children).forEach((li, i) => {
                    li.style.background = i === selectedHistoryIndex ? '#f0f8ff' : '';
                    li.style.fontWeight = i === selectedHistoryIndex ? 'bold' : '';
                });
            }
        }, 80);
    };

    window.jumpToHistoryState = function(index, notify = true) {
        const file = getActiveFile();
        if (!file || !file.history[index]) return;

        if (index !== file.historyIndex) {
            file.historyIndex = index;
            restoreState(file, file.history[index]);
            if (document.getElementById('historyModal').classList.contains('active')) {
                updateHistoryModal();
            }
            if (notify) console.log(`✅ Переход к состоянию #${index + 1}`);
        }
    };

    window.jumpToSelectedState = function() {
        if (selectedHistoryIndex !== -1) jumpToHistoryState(selectedHistoryIndex);
    };

    window.clearHistory = function() {   // кнопка "Очистить"
        const file = getActiveFile();
        if (!file || !confirm('Очистить всю историю?')) return;

        const cur = captureState(file);
        file.history = [cur];
        file.historyIndex = 0;
        if (document.getElementById('historyModal').classList.contains('active')) updateHistoryModal();
    };

    // Заглушки, если функций ещё нет
    // ==================== УЛУЧШЕННОЕ ОПРЕДЕЛЕНИЕ НАЗВАНИЯ ДЕЙСТВИЯ ====================
    function getActionName(state) {
        if (!state || !state.action) return 'Изменение';

        const map = {
            'Рисование кистью': 'Рисование кистью',
            'Рисование карандашом': 'Рисование карандашом',
            'Стирание': 'Стирание ластиком',
            'Заливка': 'Заливка',
            'Добавление текста': 'Добавление текста',
            'Линия': 'Линия',
            'Прямоугольник': 'Прямоугольник',
            'Эллипс': 'Эллипс',
            'Выделение лассо': 'Выделение лассо',
            'Обрезка': 'Обрезка',
            'Поворот': 'Поворот',
            'Отражение': 'Отражение',
            'Медианный фильтр': 'Медианный фильтр',
            'Пороговая обработка': 'Порог',
            'Нормализация': 'Нормализация',
            'Аппроксимация поверхностью': 'Аппроксимация',
            'Изменение размера': 'Изменение размера',
            'Инверсия цветов': 'Инверсия',
            'Оттенки серого': 'Оттенки серого'
        };

        return map[state.action] || state.action;
    }
    if (typeof getActionIcon !== 'function') window.getActionIcon = () => '📄';
    if (typeof formatTimestamp !== 'function') {
        window.formatTimestamp = ts => new Date(ts).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    }

    // ====================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ИСТОРИИ ======================

    // Проверка, открыто ли окно истории (используется в pushState)
    window.isHistoryModalOpen = function() {
        const modal = document.getElementById('historyModal');
        return modal && modal.classList.contains('active');
    };

    // Обновление модального окна истории
    window.updateHistoryModal = updateHistoryModal;   // если уже есть — просто сделаем глобальной

    // Временное восстановление состояния
    window.temporaryRestore = function(index) {
        const file = getActiveFile();
        if (!file || !file.history[index]) return;
        restoreState(file, file.history[index]);
    };

    // Дебounce для слайдера
    window.debounceTemporaryRestore = function(value) {
        if (restoreTimer) clearTimeout(restoreTimer);
        restoreTimer = setTimeout(() => {
            temporaryRestore(parseInt(value));
            selectedHistoryIndex = parseInt(value);
            
            const ul = document.getElementById('historyListBody');
            if (ul) {
                Array.from(ul.children).forEach((li, i) => {
                    li.style.background = (i === selectedHistoryIndex) ? '#f0f8ff' : '';
                    li.style.fontWeight = (i === selectedHistoryIndex) ? 'bold' : '';
                });
            }
        }, 80);
    };

    // Переход к состоянию
    window.jumpToHistoryState = function(index, notify = true) {
        const file = getActiveFile();
        if (!file || !file.history[index]) return;

        if (index !== file.historyIndex) {
            file.historyIndex = index;
            restoreState(file, file.history[index]);
            if (isHistoryModalOpen()) updateHistoryModal();
            if (notify) console.log(`Переход к состоянию #${index + 1}`);
        }
    };

    window.jumpToSelectedState = function() {
        if (selectedHistoryIndex !== -1) jumpToHistoryState(selectedHistoryIndex);
    };

    window.clearHistory = function() {
        const file = getActiveFile();
        if (!file || !confirm('Очистить всю историю?')) return;

        const currentState = captureState(file);
        file.history = [currentState];
        file.historyIndex = 0;
        if (isHistoryModalOpen()) updateHistoryModal();
        console.log('История очищена');
    };


        // ====================== МОДАЛЬНОЕ ОКНО ПОМОЩИ ======================
    
    // Показать окно помощи
    window.showHelpModal = function() {
        const modal = document.getElementById('helpModal');
        if (!modal) return console.error('helpModal не найден');
        modal.classList.add('active');
    };

    // Закрыть окно помощи
    window.closeHelpModal = function() {
        const modal = document.getElementById('helpModal');
        if (modal) modal.classList.remove('active');
    };

    console.log('✅ Функции окна помощи добавлены');
    
    console.log('✅ Глобальные функции истории добавлены');

    console.log('✅ История изменений загружена (showHistoryModal глобальная)');

})();