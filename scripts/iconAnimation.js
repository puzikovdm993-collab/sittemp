/**
 * Модуль анимации иконок папки и синхронизации
 * Позволяет активировать анимацию на заданное время
 */

class IconAnimationController {
    /**
     * Конструктор класса
     * @param {Object} options - Настройки анимации
     * @param {number} options.defaultDuration - Длительность анимации по умолчанию (мс)
     */
    constructor(options = {}) {
        this.defaultDuration = options.defaultDuration || 3000; // 3 секунды по умолчанию
        this.activeAnimations = new Map(); // Хранит таймеры активных анимаций
    }

    /**
     * Активировать анимацию иконки папки
     * @param {string|Element} target - Селектор или DOM элемент иконки
     * @param {number} duration - Длительность анимации в мс (по умолчанию 3000)
     * @returns {Promise} - Промис, который разрешается после завершения анимации
     */
    activateFolderAnimation(target, duration = this.defaultDuration) {
        return new Promise((resolve, reject) => {
            try {
                const element = this._getElement(target);
                if (!element) {
                    reject(new Error('Элемент не найден'));
                    return;
                }

                // Добавляем класс активации
                element.classList.add('folder-loading-active');
                element.classList.remove('folder-loading-inactive');

                // Очищаем предыдущий таймер если он был
                if (this.activeAnimations.has(element)) {
                    clearTimeout(this.activeAnimations.get(element));
                }

                // Устанавливаем таймер для деактивации
                const timerId = setTimeout(() => {
                    this.deactivateFolderAnimation(element);
                    resolve();
                }, duration);

                this.activeAnimations.set(element, timerId);

                console.log(`Анимация папки активирована на ${duration}мс`);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Деактивировать анимацию иконки папки
     * @param {string|Element} target - Селектор или DOM элемент иконки
     */
    deactivateFolderAnimation(target) {
        try {
            const element = this._getElement(target);
            if (!element) return;

            // Очищаем таймер
            if (this.activeAnimations.has(element)) {
                clearTimeout(this.activeAnimations.get(element));
                this.activeAnimations.delete(element);
            }

            // Удаляем класс активации
            element.classList.remove('folder-loading-active');
            element.classList.add('folder-loading-inactive');

            console.log('Анимация папки деактивирована');
        } catch (error) {
            console.error('Ошибка при деактивации анимации папки:', error);
        }
    }

    /**
     * Активировать анимацию иконки синхронизации
     * @param {string|Element} target - Селектор или DOM элемент иконки
     * @param {number} duration - Длительность анимации в мс (по умолчанию 3000)
     * @returns {Promise} - Промис, который разрешается после завершения анимации
     */
    activateSyncAnimation(target, duration = this.defaultDuration) {
        return new Promise((resolve, reject) => {
            try {
                const element = this._getElement(target);
                if (!element) {
                    reject(new Error('Элемент не найден'));
                    return;
                }

                // Добавляем класс активации
                element.classList.add('sync-active');
                element.classList.remove('sync-inactive');

                // Очищаем предыдущий таймер если он был
                if (this.activeAnimations.has(element)) {
                    clearTimeout(this.activeAnimations.get(element));
                }

                // Устанавливаем таймер для деактивации
                const timerId = setTimeout(() => {
                    this.deactivateSyncAnimation(element);
                    resolve();
                }, duration);

                this.activeAnimations.set(element, timerId);

                console.log(`Анимация синхронизации активирована на ${duration}мс`);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Деактивировать анимацию иконки синхронизации
     * @param {string|Element} target - Селектор или DOM элемент иконки
     */
    deactivateSyncAnimation(target) {
        try {
            const element = this._getElement(target);
            if (!element) return;

            // Очищаем таймер
            if (this.activeAnimations.has(element)) {
                clearTimeout(this.activeAnimations.get(element));
                this.activeAnimations.delete(element);
            }

            // Удаляем класс активации
            element.classList.remove('sync-active');
            element.classList.add('sync-inactive');

            console.log('Анимация синхронизации деактивирована');
        } catch (error) {
            console.error('Ошибка при деактивации анимации синхронизации:', error);
        }
    }

    /**
     * Активировать обе анимации одновременно
     * @param {Object} targets - Объект с селекторами для папки и синхронизации
     * @param {string|Element} targets.folder - Селектор или элемент для папки
     * @param {string|Element} targets.sync - Селектор или элемент для синхронизации
     * @param {number} duration - Длительность анимации в мс
     * @returns {Promise} - Промис, который разрешается после завершения всех анимаций
     */
    activateAllAnimations(targets, duration = this.defaultDuration) {
        return Promise.all([
            this.activateFolderAnimation(targets.folder, duration),
            this.activateSyncAnimation(targets.sync, duration)
        ]);
    }

    /**
     * Деактивировать все анимации
     */
    deactivateAllAnimations() {
        this.activeAnimations.forEach((timerId, element) => {
            clearTimeout(timerId);
            
            // Пробуем деактивировать оба типа анимаций
            element.classList.remove('folder-loading-active', 'sync-active');
            element.classList.add('folder-loading-inactive', 'sync-inactive');
        });
        
        this.activeAnimations.clear();
        console.log('Все анимации деактивированы');
    }

    /**
     * Проверить, активна ли анимация для элемента
     * @param {string|Element} target - Селектор или DOM элемент иконки
     * @returns {boolean} - true если анимация активна
     */
    isAnimationActive(target) {
        const element = this._getElement(target);
        if (!element) return false;
        
        return this.activeAnimations.has(element);
    }

    /**
     * Получить количество активных анимаций
     * @returns {number} - Количество активных анимаций
     */
    getActiveAnimationsCount() {
        return this.activeAnimations.size;
    }

    /**
     * Вспомогательный метод для получения DOM элемента
     * @param {string|Element} target - Селектор или DOM элемент
     * @returns {Element|null} - DOM элемент или null
     * @private
     */
    _getElement(target) {
        if (!target) return null;
        
        if (typeof target === 'string') {
            return document.querySelector(target);
        }
        
        if (target instanceof Element) {
            return target;
        }
        
        return null;
    }
}

// Создаем глобальный экземпляр контроллера
const iconAnimation = new IconAnimationController();

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { IconAnimationController, iconAnimation };
}

// Примеры использования:
// 
// 1. Активировать анимацию папки на 3 секунды:
//    iconAnimation.activateFolderAnimation('#my-folder-icon', 3000);
//
// 2. Активировать анимацию синхронизации на 5 секунд:
//    iconAnimation.activateSyncAnimation('#my-sync-icon', 5000);
//
// 3. Активировать обе анимации:
//    iconAnimation.activateAllAnimations({
//        folder: '#folder-icon',
//        sync: '#sync-icon'
//    }, 4000);
//
// 4. Деактивировать анимацию досрочно:
//    iconAnimation.deactivateFolderAnimation('#my-folder-icon');
//    iconAnimation.deactivateSyncAnimation('#my-sync-icon');
//
// 5. Деактивировать все анимации:
//    iconAnimation.deactivateAllAnimations();
