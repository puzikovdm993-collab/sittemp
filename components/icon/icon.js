'use strict';

/**
 * SpriteLoader - загружает внешний SVG-спрайт и вставляет его в DOM,
 * чтобы иконки через <use href="#id"> стали доступны.
 */
class SpriteLoader {
    constructor(spritePath) {
        this.spritePath = spritePath;
        this.init();
    }

    async init() {
        try {
            const response = await fetch(this.spritePath);
            if (!response.ok) throw new Error(`Ошибка загрузки спрайта: ${response.status}`);
            
            const svgContent = await response.text();
            
            // Создаем контейнер для спрайта (скрытый)
            const wrapper = document.createElement('div');
            wrapper.style.display = 'none';
            wrapper.innerHTML = svgContent;
            
            // Вставляем в начало body
            document.body.prepend(wrapper);
        } catch (error) {
            console.error('SVG Sprite Error:', error);
        }
    }
}

// Инициализируем загрузку при старте приложения
document.addEventListener('DOMContentLoaded', () => {
    new SpriteLoader('components/icon/icons.svg');
});

// document.addEventListener('DOMContentLoaded', () => {
//     const svgPath = `${window.APP_CONFIG.staticUrl}/components/icon/icons.svg`;
//     new SpriteLoader(svgPath);
// });

