/**
 * Универсальный компонент модального окна
 */

//  style="min-width: 450px; min-height: 300px; max-width: none; max-height: none; margin: 0px; width: 1728px; height: 393px; left: 97px; top: 286.5px;"
//  style="min-width: 450px; min-height: 300px; max-width: 90vw; max-height: 90vh; margin: auto;"
const Modal = {
    overlay: null,
    modal: null,
    titleEl: null,
    bodyEl: null,
    footerEl: null,
    closeBtn: null,
    isDragging: false,
    isResizing: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    resizeStartX: 0,
    resizeStartY: 0,
    resizeStartWidth: 0,
    resizeStartHeight: 0,
    currentConfig: null,
    onCloseCallback: null,

    /**
     * Инициализация модального окна
     */
    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.modal = document.getElementById('modal');
        this.titleEl = document.getElementById('modalTitle');
        this.bodyEl = document.getElementById('modalBody');
        this.footerEl = document.getElementById('modalFooter');
        this.closeBtn = document.getElementById('modalClose');

        // Закрытие по клику на оверлей (проверяется в open)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay && this.currentConfig?.closeOnOverlayClick !== false) {
                // Если backdrop === 'static', закрытие по клику на оверлей запрещено
                if (this.currentConfig?.backdrop === 'static') {
                    return;
                }
                this.close();
            }
        });

        // Закрытие по кнопке
        this.closeBtn.addEventListener('click', () => {
            this.close();
        });

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close();
            }
        });

        // Обработка Enter для выполнения основного действия
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.overlay.classList.contains('active')) {
                e.preventDefault();
                this.handleEnterAction();
            }
        });

        // Инициализация перетаскивания и изменения размера
        this.initDraggable();
        this.initResizable();
    },

    /**
     * Инициализация перетаскивания
     */
    initDraggable() {
        const header = this.modal.querySelector('.modal-header');
        
        // Начало перетаскивания
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.modal-close')) return;
            
            this.isDragging = true;
            
            // Сохраняем текущие размеры перед перетаскиванием
            const rect = this.modal.getBoundingClientRect();
            const overlayRect = this.overlay.getBoundingClientRect();
            
            // Устанавливаем абсолютное позиционирование с сохранением размеров
            this.modal.style.width = `${rect.width}px`;
            this.modal.style.height = `${rect.height}px`;

            this.modal.classList.add('draggable');

            this.modal.style.left = `${rect.left - overlayRect.left}px`;
            this.modal.style.top = `${rect.top - overlayRect.top}px`;

            this.modal.style.margin = '0';
            
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            
            e.preventDefault();
        });

        // Перетаскивание
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const overlayRect = this.overlay.getBoundingClientRect();
                const modalRect = this.modal.getBoundingClientRect();
                
                let newLeft = e.clientX - overlayRect.left - this.dragOffsetX;
                let newTop = e.clientY - overlayRect.top - this.dragOffsetY;
                
                // Ограничение границами оверлея
                const maxLeft = overlayRect.width - modalRect.width;
                const maxTop = overlayRect.height - modalRect.height;
                
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));
                
                this.modal.style.left = `${newLeft}px`;
                this.modal.style.top = `${newTop}px`;
            }
        });

        // Конец перетаскивания
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    },

    /**
     * Инициализация изменения размера
     */
    initResizable() {
        
        const resizeHandle = this.modal.querySelector('.modal-resize-handle');
        
        if (!resizeHandle) return;
        
        // Начало изменения размера
        resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            
            const rect = this.modal.getBoundingClientRect();
            this.resizeStartX = e.clientX;
            this.resizeStartY = e.clientY;
            this.resizeStartWidth = rect.width;
            this.resizeStartHeight = rect.height;
            
            e.preventDefault();
            e.stopPropagation();
        });

        // Изменение размера
        document.addEventListener('mousemove', (e) => {
            if (this.isResizing) {
                const deltaX = e.clientX - this.resizeStartX;
                const deltaY = e.clientY - this.resizeStartY;
                
                let newWidth = this.resizeStartWidth + deltaX;
                let newHeight = this.resizeStartHeight + deltaY;
                
                // Ограничения минимального и максимального размера
                // Используем индивидуальные настройки из конфигурации или значения по умолчанию
                const minWidth = this.currentConfig?.minWidth || 300;
                const minHeight = this.currentConfig?.minHeight || 200;
                const maxWidth = this.overlay.clientWidth - 50;
                const maxHeight = this.overlay.clientHeight - 50;
                
                newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
                newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
                
                this.modal.style.width = `${newWidth}px`;
                this.modal.style.height = `${newHeight}px`;
            }
        });

        // Конец изменения размера
        document.addEventListener('mouseup', () => {
            this.isResizing = false;
        });
    },

    /**
     * Обработка нажатия Enter - выполнение основного действия
     */
    handleEnterAction() {
        // Проверяем обязательные поля перед выполнением действия
        if (!this.validateRequiredFields()) {
            return;
        }
        
        // Ищем первую кнопку с классом btn-primary (основное действие)
        const primaryBtn = this.footerEl.querySelector('.btn-primary');
        if (primaryBtn) {
            primaryBtn.click();
            return;
        }
        
        // Если нет кнопки btn-primary, ищем любую кнопку в футере
        const anyBtn = this.footerEl.querySelector('button');
        if (anyBtn) {
            anyBtn.click();
            return;
        }
        
        // Если кнопок нет, ищем форму и отправляем её
        const form = this.bodyEl.querySelector('form');
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    },

    /**
     * Проверка обязательных полей
     */
    validateRequiredFields() {
        const requiredFields = this.currentConfig?.requiredFields || [];
        let isValid = true;
        
        // Очищаем предыдущие ошибки
        this.clearErrors();
        
        requiredFields.forEach(field => {
            const input = this.bodyEl.querySelector(`[name="${field}"]`);
            if (input) {
                const value = input.type === 'checkbox' ? input.checked : input.value;
                
                // Проверка на пустое значение
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    this.showError(field, 'Это поле обязательно для заполнения');
                    isValid = false;
                }
            }
        });
        
        return isValid;
    },

    /**
     * Открытие модального окна
     * @param {Object} options - Настройки модального окна
     * @param {string} [options.title=''] - Заголовок модального окна
     * @param {string} [options.content=''] - HTML содержимое тела модального окна
     * @param {Array} [options.buttons=[]] - Массив кнопок для футера
     * @param {Function} [options.onClose=null] - Callback функция при закрытии
     * @param {number} [options.minWidth=300] - Минимальная ширина в пикселях
     * @param {number} [options.minHeight=200] - Минимальная высота в пикселях
     * @param {number} [options.minWidth=400] - Максимальная ширина в пикселях
     * @param {number} [options.minHeight=300] - Максимальная высота в пикселях
     * @param {Array} [options.requiredFields=[]] - Массив обязательных полей для валидации
     * @param {boolean} [options.closeOnOverlayClick=true] - Закрывать ли при клике на оверлей
     * @param {boolean|string} [options.backdrop=true] - Настройка затемнения фона:
     *   - true (по умолчанию): стандартное затемнение с возможностью закрытия по клику
     *   - 'static': усиленное затемнение, закрытие по клику на оверлей запрещено
     *   - false: без затемнения, клики проходят сквозь оверлей
     */
    open(options = {}) {
        const {
            title = '',
            content = '',
            buttons = [],
            onClose = null,
            minWidth = 300,
            minHeight = 200,
            maxWidth = 400,
            maxHeight = 300,
            requiredFields = [],
            closeOnOverlayClick = true,
            backdrop = true // 'static' | true | false
        } = options;

        // Сохраняем конфигурацию для текущего модального окна
        this.currentConfig = {
            minWidth: minWidth,
            minHeight: minHeight,
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            requiredFields: requiredFields,
            closeOnOverlayClick: closeOnOverlayClick,
            backdrop: backdrop
        };

        this.titleEl.textContent = title;
        this.bodyEl.innerHTML = content;
        
        // Сбрасываем стили размеров и устанавливаем индивидуальные минимальные размеры
        this.modal.style.width = `${minWidth}px`;
        this.modal.style.height = `${minHeight}px`;
        
        this.modal.style.minWidth = `${minWidth}px`;
        this.modal.style.minHeight = `${minHeight}px`;
        this.modal.style.maxWidth = `${maxWidth}px`;
        this.modal.style.maxHeight = `${maxHeight}px`;
        
        // Сбрасываем позиции для центрирования
        // this.modal.style.left = '';
        // this.modal.style.top = '';
        // this.modal.style.left = `${300}px`;
        // this.modal.style.top = `${300}px`;
        this.modal.style.left = '20vw';
        this.modal.style.top = '20vh';
        this.modal.style.margin = '0';

        // this.modal.classList.remove('draggable');
        this.modal.classList.add('draggable');
        
        // Настраиваем backdrop (затенение фона)
        this.overlay.classList.remove('backdrop-static', 'backdrop-disabled');
        if (backdrop === 'static') {
            this.overlay.classList.add('backdrop-static');
        } else if (backdrop === false) {
            this.overlay.classList.add('backdrop-disabled');
        }
        
        // Создаем кнопки
        this.footerEl.innerHTML = '';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class || 'btn-secondary'}`;
            button.textContent = btn.text;
            button.addEventListener('click', () => {
                // Проверяем обязательные поля перед выполнением действия
                if (btn.class?.includes('btn-primary') && !this.validateRequiredFields()) {
                    return;
                }
                
                if (btn.onClick) {
                    btn.onClick();
                }
                if (btn.close !== false) {
                    this.close();
                }
            });
            this.footerEl.appendChild(button);
        });

        // Сохраняем callback закрытия
        this.onCloseCallback = onClose;

        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Закрытие модального окна
     */
    close() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
        
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    },

    /**
     * Получение данных из формы в модальном окне
     */
    getFormData() {
        const formData = {};
        const inputs = this.bodyEl.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const name = input.name;
            if (name) {
                formData[name] = input.type === 'checkbox' ? input.checked : input.value;
            }
        });
        
        return formData;
    },

    /**
     * Установка значения поля
     */
    setFieldValue(name, value) {
        const input = this.bodyEl.querySelector(`[name="${name}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = value;
            } else {
                input.value = value;
            }
        }
    },

    /**
     * Очистка ошибок валидации
     */
    clearErrors() {
        const errors = this.bodyEl.querySelectorAll('.form-error');
        errors.forEach(el => el.remove());
        
        const invalidInputs = this.bodyEl.querySelectorAll('.form-input.error, .form-select.error');
        invalidInputs.forEach(el => el.classList.remove('error'));
    },

    /**
     * Показать ошибку валидации
     */
    showError(field, message) {
        const input = this.bodyEl.querySelector(`[name="${field}"]`);
        if (input) {
            input.classList.add('error');
            
            const errorEl = document.createElement('div');
            errorEl.className = 'form-error';
            errorEl.textContent = message;
            input.parentNode.appendChild(errorEl);
        }
    },

    /**
     * Показать ошибки валидации
     */
    showErrors(errors) {
        this.clearErrors();
        
        Object.entries(errors).forEach(([field, message]) => {
            this.showError(field, message);
        });
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
});

