// ==========================================
// Функции для переключения вкладок (Tabs)
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // // Контент для ribbon-панели по каждой вкладке
    // const ribbonContent = {
    //     'file': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showLoadMethodModal()">
    //                     <svg class="icon"><use href="#icon-folder"></use></svg> Открыть
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showSaveMethodModal()">
    //                     <svg class="icon"><use href="#icon-save"></use></svg> Сохранить
    //                 </button>
    //             </div>
    //             <span class="ribbon-group-title">Файл</span>
    //         </div>
    //     `,
    //     'edit': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="undo()">
    //                     <svg class="icon"><use href="#icon-undo"></use></svg> Отмена
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="redo()">
    //                     <svg class="icon"><use href="#icon-redo"></use></svg> Повтор
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showHistoryModal()">
    //                     <svg class="icon"><use href="#icon-history"></use></svg> История
    //                 </button>
    //             </div>
    //             <span class="ribbon-group-title">Правка</span>
    //         </div>
    //     `,
    //     'view': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="zoomIn()">
    //                     <svg class="icon"><use href="#icon-zoom-in"></use></svg> +
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="zoomOut()">
    //                     <svg class="icon"><use href="#icon-zoom-out"></use></svg> −
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="zoomReset()">100%</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="fitImageToScreen()">По размеру</button>
    //             </div>
    //             <span class="ribbon-group-title">Вид</span>
    //         </div>
    //     `,
    //     'image': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="cropToSelection()">
    //                     <svg class="icon"><use href="#icon-crop"></use></svg> Обрезать
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="rotateCanvas(90)">
    //                     <svg class="icon"><use href="#icon-rotate-right"></use></svg> 90°
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="flipCanvas('horizontal')">
    //                     <svg class="icon"><use href="#icon-flip-h"></use></svg> ↔
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="flipCanvas('vertical')">
    //                     <svg class="icon"><use href="#icon-flip-v"></use></svg> ↕
    //                 </button>
    //             </div>
    //             <span class="ribbon-group-title">Изображение</span>
    //         </div>
    //     `,
    //     'filters': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="applyEdgeFilter()">Контур</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="applyEdgeDetection()">Границы</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="applyReliefFilter()">Рельеф</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="applySobelFilter()">Sobel</button>
    //             </div>
    //             <span class="ribbon-group-title">Фильтры</span>
    //         </div>
    //     `,
    //     'adjustments': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showBrightnessContrastModal()">Яркость/Контраст</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showColorBalanceModal()">Цвет</button>
    //             </div>
    //             <span class="ribbon-group-title">Регулировка</span>
    //         </div>
    //     `,
    //     'shapes': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="setTool('line')">Линия</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="setTool('rect')">Прямоуг.</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="setTool('ellipse')">Эллипс</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="setTool('triangle')">Треуг.</button>
    //             </div>
    //             <span class="ribbon-group-title">Фигуры</span>
    //         </div>
    //     `,
    //     'tools': `
    //         <div class="ribbon-group">
    //             <div class="ribbon-buttons">
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showCodeLabModal()">
    //                     <svg class="icon"><use href="#icon-code"></use></svg> Скрипты
    //                 </button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showSRTIModal()">СРТИ</button>
    //                 <button class="ribbon-btn ribbon-tab-btn" onclick="showFXMModal()">ФХМ</button>
    //             </div>
    //             <span class="ribbon-group-title">Инструменты</span>
    //         </div>
    //     `
    // };
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Убираем активный класс со всех кнопок и панелей
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке и панели
            this.classList.add('active');
            const targetPane = document.getElementById('tab-' + tabId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            // Обновляем контент ribbon-панели
            const ribbonDynamicContent = document.getElementById('ribbonDynamicContent');
            if (ribbonDynamicContent && ribbonContent[tabId]) {
                ribbonDynamicContent.innerHTML = ribbonContent[tabId];
            }
            
            // Обновляем поле с файлом в tabs-container
            updateTabsFileField();
        });
    });
    
    // Инициализация при загрузке
    updateTabsFileField();
});

// Функция обновления поля с файлом
function updateTabsFileField() {
    const tabsFileField = document.getElementById('tabsFileField');
    const tabsFileName = document.getElementById('tabsFileName');
    const currentFileLabel = document.getElementById('currentFileLabel');
    
    if (tabsFileField && tabsFileName && currentFileLabel) {
        // Показываем поле с файлом во всех вкладках
        tabsFileField.style.display = 'flex';
        
        // Получаем имя текущего файла из ribbon
        if (currentFileLabel.style.display !== 'none') {
            tabsFileName.textContent = currentFileLabel.textContent;
        } else {
            tabsFileName.textContent = 'Безымянный';
        }
    }
}