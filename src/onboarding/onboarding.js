// onboarding.js - Product Tour (Онбординг) для WTIS
(function() {
    'use strict';

    // Конфигурация
    const TOUR_STEPS = [
        {
            id: 'step-tabs',
            target: '.tabs-container',
            title: 'Панель вкладок',
            content: 'Здесь расположены основные вкладки приложения: Файл, Правка, Вид, Изображение, Фильтры, Регулировка, Инструменты, Режимы и Настройки. Каждая вкладка содержит соответствующие инструменты.',
            position: 'bottom',
            highlightPadding: 10
        },
        {
            id: 'step-file-tab',
            target: '#tab-file',
            title: 'Вкладка "Файл"',
            content: 'Управление файлами: открытие изображений с компьютера или сервера, сохранение результатов, переключение между открытыми файлами.',
            position: 'bottom',
            action: () => {
                document.querySelector('[data-tab="file"]')?.click();
            }
        },
        {
            id: 'step-open-files',
            target: '#openFilesDropdownBtn',
            title: 'Открытые файлы',
            content: 'Кнопка отображает текущий активный файл и количество открытых изображений. Нажмите для просмотра списка всех открытых файлов и переключения между ними.',
            position: 'right'
        },
        {
            id: 'step-edit-tab',
            target: '#tab-edit',
            title: 'Вкладка "Правка"',
            content: 'Работа с историей действий: отмена (Ctrl+Z), повтор (Ctrl+Y) и просмотр истории изменений (Ctrl+H).',
            position: 'bottom',
            action: () => {
                document.querySelector('[data-tab="edit"]')?.click();
            }
        },
        {
            id: 'step-view-tab',
            target: '#tab-view',
            title: 'Вкладка "Вид"',
            content: 'Управление отображением: увеличение/уменьшение масштаба, сброс к 100%, подгонка по размеру окна.',
            position: 'bottom',
            action: () => {
                document.querySelector('[data-tab="view"]')?.click();
            }
        },
        {
            id: 'step-canvas',
            target: '#canvasWrapper',
            title: 'Рабочая область',
            content: 'Основная область для работы с изображением. Здесь отображается загруженное изображение, можно применять фильтры, рисовать, выделять области.',
            position: 'top'
        },
        {
            id: 'step-filters-tab',
            target: '#tab-filters',
            title: 'Вкладка "Фильтры"',
            content: 'Применение фильтров: выделение контуров, поиск объектов (окружности, оси симметрии), предварительная обработка, медианный фильтр и нормализация.',
            position: 'bottom',
            action: () => {
                document.querySelector('[data-tab="filters"]')?.click();
            }
        },
        {
            id: 'step-tools-tab',
            target: '#tab-tools',
            title: 'Вкладка "Инструменты"',
            content: 'Специализированные инструменты: Code Lab для выполнения пользовательских скриптов, СРТИ для фильтрации, Фотохронометрия.',
            position: 'bottom',
            action: () => {
                document.querySelector('[data-tab="tools"]')?.click();
            }
        },
        {
            id: 'step-help-btn',
            target: '.help-btn',
            title: 'Помощь',
            content: 'Кнопка вызова подробной справки по всем функциям приложения. Также здесь можно запустить обучение заново.',
            position: 'left'
        }
    ];

    // Состояние обучения
    let currentStepIndex = 0;
    let isTourActive = false;
    let tourOverlay = null;
    let tourTooltip = null;

    // Проверка поддержки localStorage
    function isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Получить статус прохождения онбординга
    function getOnboardingStatus() {
        if (!isLocalStorageAvailable()) return false;
        return localStorage.getItem('wtis_onboarding_completed') === 'true';
    }

    // Установить статус прохождения онбординга
    function setOnboardingStatus(completed) {
        if (!isLocalStorageAvailable()) return;
        localStorage.setItem('wtis_onboarding_completed', completed ? 'true' : 'false');
    }

    // Создание overlay для подсветки
    function createOverlay() {
        if (tourOverlay) return tourOverlay;

        tourOverlay = document.createElement('div');
        tourOverlay.id = 'tourOverlay';
        tourOverlay.className = 'tour-overlay';
        
        // Клик по overlay не закрывает тур
        tourOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.body.appendChild(tourOverlay);
        return tourOverlay;
    }

    // Создание tooltip с информацией о шаге
    function createTooltip() {
        if (tourTooltip) return tourTooltip;

        tourTooltip = document.createElement('div');
        tourTooltip.id = 'tourTooltip';
        tourTooltip.className = 'tour-tooltip';
        
        tourTooltip.innerHTML = `
            <div class="tour-tooltip-header">
                <h3 class="tour-tooltip-title"></h3>
                <button class="tour-tooltip-close" onclick="window.closeProductTour()">×</button>
            </div>
            <div class="tour-tooltip-content"></div>
            <div class="tour-tooltip-footer">
                <div class="tour-progress">
                    <span class="tour-step-current">1</span> / <span class="tour-step-total">${TOUR_STEPS.length}</span>
                </div>
                <div class="tour-buttons">
                    <button class="tour-btn tour-btn-prev" onclick="window.prevTourStep()" disabled>← Назад</button>
                    <button class="tour-btn tour-btn-next" onclick="window.nextTourStep()">Далее →</button>
                    <button class="tour-btn tour-btn-finish" onclick="window.finishTour()" style="display:none;">Завершить</button>
                </div>
            </div>
        `;

        document.body.appendChild(tourTooltip);
        return tourTooltip;
    }

    // Обновление позиции tooltip относительно целевого элемента
    function updateTooltipPosition(targetElement) {
        if (!targetElement || !tourTooltip) return;

        const rect = targetElement.getBoundingClientRect();
        const step = TOUR_STEPS[currentStepIndex];
        const position = step?.position || 'bottom';

        const tooltipRect = tourTooltip.getBoundingClientRect();
        const padding = step?.highlightPadding || 20;

        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - tooltipRect.height - padding;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + padding;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - padding;
                break;
            case 'bottom':
            default:
                top = rect.bottom + padding;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
        }

        // Корректировка, чтобы tooltip не выходил за пределы экрана
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < 10) left = 10;
        if (left + tooltipRect.width > viewportWidth - 10) {
            left = viewportWidth - tooltipRect.width - 10;
        }
        if (top < 10) top = 10;
        if (top + tooltipRect.height > viewportHeight - 10) {
            top = viewportHeight - tooltipRect.height - 10;
        }
        top = viewportHeight/2;
        left = viewportWidth/2;
        tourTooltip.style.top = `${top}px`;
        tourTooltip.style.left = `${left}px`;
    }

    // Подсветка целевого элемента
    function highlightElement(element) {
        if (!element) return;

        // Удаляем предыдущую подсветку
        document.querySelectorAll('.tour-highlighted').forEach(el => {
            el.classList.remove('tour-highlighted');
        });

        element.classList.add('tour-highlighted');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Показ текущего шага
    function showStep(index) {
        if (index < 0 || index >= TOUR_STEPS.length) return;

        currentStepIndex = index;
        const step = TOUR_STEPS[index];
        const targetElement = document.querySelector(step.target);

        if (!targetElement) {
            console.warn(`Целевой элемент не найден: ${step.target}`);
            // Пропускаем шаг, если элемент не найден
            if (index < TOUR_STEPS.length - 1) {
                setTimeout(() => nextTourStep(), 100);
            }
            return;
        }

        // Выполняем действие шага, если указано
        if (step.action && typeof step.action === 'function') {
            step.action();
        }
        
        // Позиционируем tooltip
        setTimeout(() => updateTooltipPosition(targetElement), 30);


        // Создаем элементы, если их нет
        createOverlay();
        createTooltip();

        // Обновляем содержимое tooltip
        const titleEl = tourTooltip.querySelector('.tour-tooltip-title');
        const contentEl = tourTooltip.querySelector('.tour-tooltip-content');
        const currentStepEl = tourTooltip.querySelector('.tour-step-current');
        const totalStepsEl = tourTooltip.querySelector('.tour-step-total');
        const prevBtn = tourTooltip.querySelector('.tour-btn-prev');
        const nextBtn = tourTooltip.querySelector('.tour-btn-next');
        const finishBtn = tourTooltip.querySelector('.tour-btn-finish');

        if (titleEl) titleEl.textContent = step.title;
        if (contentEl) contentEl.textContent = step.content;
        if (currentStepEl) currentStepEl.textContent = index + 1;
        if (totalStepsEl) totalStepsEl.textContent = TOUR_STEPS.length;

        // Обновляем состояние кнопок
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.style.display = index === TOUR_STEPS.length - 1 ? 'none' : 'inline-block';
        if (finishBtn) finishBtn.style.display = index === TOUR_STEPS.length - 1 ? 'inline-block' : 'none';

        // Подсвечиваем элемент
        highlightElement(targetElement);


    }

    // Переход к следующему шагу
    function nextTourStep() {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
            showStep(currentStepIndex + 1);
        }
    }

    // Переход к предыдущему шагу
    function prevTourStep() {
        if (currentStepIndex > 0) {
            showStep(currentStepIndex - 1);
        }
    }

    // Завершение обучения
    function finishTour() {
        setOnboardingStatus(true);
        closeProductTour();
        
        // Показываем уведомление о завершении
        showToast('🎉 Обучение завершно! Теперь вы знаете основы работы с WTIS.');
    }

    // Закрытие обучения
    function closeProductTour() {
        isTourActive = false;

        // Удаляем overlay и tooltip
        if (tourOverlay) {
            tourOverlay.remove();
            tourOverlay = null;
        }
        if (tourTooltip) {
            tourTooltip.remove();
            tourTooltip = null;
        }

        // Удаляем подсветку
        document.querySelectorAll('.tour-highlighted').forEach(el => {
            el.classList.remove('tour-highlighted');
        });

        currentStepIndex = 0;
    }

    // Запуск тура
    function startProductTour() {
        if (isTourActive) return;

        isTourActive = true;
        currentStepIndex = 0;
        showStep(0);
    }

    // Показ уведомления (toast)
    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'tour-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('tour-toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Проверка первого запуска
    function checkFirstLaunch() {
        if (!getOnboardingStatus()) {
            // Показываем предложение начать тур через небольшую задержку
            setTimeout(() => {
                const welcomeToast = document.createElement('div');
                welcomeToast.className = 'tour-welcome';
                welcomeToast.innerHTML = `
                    <p>Пройти краткий обзор ключевых функций?</p>
                    <div class="tour-welcome-buttons">
                        <button class="tour-btn tour-btn-primary" onclick="window.startProductTour()">Начать</button>
                        <button class="tour-btn tour-btn-secondary" onclick="window.skipOnboarding()">Пропустить</button>
                    </div>
                `;
                document.body.appendChild(welcomeToast);

                // Автоскрытие через 10 секунд
                setTimeout(() => {
                    if (welcomeToast.parentNode) {
                        welcomeToast.classList.add('tour-welcome-hide');
                        setTimeout(() => welcomeToast.remove(), 300);
                    }
                }, 10000);
            }, 1000);
        }
    }

    // Пропуск онбординга
    function skipOnboarding() {
        const welcomeEl = document.querySelector('.tour-welcome');
        if (welcomeEl) welcomeEl.remove();
        setOnboardingStatus(true);
    }

    // Экспорт глобальных функций
    window.startProductTour = startProductTour;
    window.closeProductTour = closeProductTour;
    window.nextTourStep = nextTourStep;
    window.prevTourStep = prevTourStep;
    window.finishTour = finishTour;
    window.skipOnboarding = skipOnboarding;

    // Добавляем кнопку запуска тура в помощь
    function addTourButtonToHelp() {
        const helpModal = document.getElementById('helpModal');
        if (!helpModal) return;

        // Находим заголовок модального окна
        const modalTitle = helpModal.querySelector('.modal-title');
        if (!modalTitle) return;

        // Проверяем, не добавлена ли уже кнопка
        let existingBtn = helpModal.querySelector('.tour-start-btn');
        if (existingBtn) return;

        const tourBtn = document.createElement('button');
        tourBtn.className = 'tour-start-btn';
        tourBtn.innerHTML = '<i class="fas fa-route"></i> Пройти обучение заново';
        tourBtn.onclick = () => {
            closeProductTour();
            const helpModalEl = document.getElementById('helpModal');
            if (helpModalEl) helpModalEl.classList.remove('active');
            setTimeout(startProductTour, 300);
        };

        // Добавляем кнопку после текста заголовка
        const titleSpan = modalTitle.querySelector('span');
        if (titleSpan) {
            titleSpan.after(tourBtn);
        } else {
            modalTitle.appendChild(tourBtn);
        }
    }

    // Инициализация после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            checkFirstLaunch();
            addTourButtonToHelp();
        });
    } else {
        checkFirstLaunch();
        addTourButtonToHelp();
    }

    console.log('✅ Onboarding.js загружен');
})();