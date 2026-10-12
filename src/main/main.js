function initDomElements() {
    dom = {
        canvasHost: document.getElementById('canvasHost'),
        canvasWrapper: document.getElementById('canvasWrapper'),
        cursorPos: document.getElementById('cursorPos'),
        canvasSize: document.getElementById('canvasSize'),
        zoomLevel: document.getElementById('zoomLevel'),
        // shapesPanel: document.getElementById('shapesPanel'),
        shapesBtn: document.getElementById('shapesBtn'),
        resizeModal: document.getElementById('resizeModal'),
        newWidth: document.getElementById('newWidth'),
        newHeight: document.getElementById('newHeight'),
        textInputOverlay: document.getElementById('textInputOverlay'),
        textInput: document.getElementById('textInput'),
        colorPicker: document.getElementById('colorPicker'),
        saveMethodModal: document.getElementById('saveMethodModal'),
        filenameModal: document.getElementById('filenameModal'),
        loadFromServerModal: document.getElementById('loadFromServerModal'),
        recentFilesModal: document.getElementById('recentFilesModal'),
        recentFilesContainer: document.getElementById('recentFilesContainer'),
        recentFilesCount: document.getElementById('recentFilesCount'),
        medianModal: document.getElementById('medianModal'),
        medianAperture: document.getElementById('newAperture')
    };
}

async function initHelpButton() {
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            const helpModal = document.getElementById('helpModal');
            if (helpModal) {
                helpModal.style.display = 'flex';
            }
        });
    }

    if (typeof attachCanvasHostEvents === 'function') {
        attachCanvasHostEvents();
    }
}




async function initApp() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');

    // 1. Инициализация БД (если есть)
    // if (typeof initDB === 'function')initDB(DB_NAME,DB_VERSION, STORE_NAME_FILES);


    // 2. Загрузка данных
    const projectData = await loadProjectMetadata(projectId);

    if (projectData) {
        project = projectData;
        console.log('Проект загружен:', project);
    } else {
        console.log('Проект не найден, создаем пустой.');
        project = typeof createDefaultProject === 'function' ? createDefaultProject() : { files: [] };
    }

    // 3. Инициализация UI
    if (typeof applySettingsTheme === 'function') applySettingsTheme(project);




    if (project.files.length > 0) {
        project.files.forEach((file, fileIndex) => {

            // Создаем canvas элемент
            const cnv = document.createElement('canvas');
            cnv.className = 'paint-canvas';
            cnv.id = `canvas-${file.id}`;
            cnv.width = file.width;
            cnv.height = file.height;
            cnv.style.display = 'none';


            attachCanvasEvents(cnv);
            const canvasHost  = document.getElementById('canvasHost');
            canvasHost.appendChild(cnv);
            
            const colorBarNames = {
                'color-bar-gray': 'gray',
                'color-bar-plasma': 'plasma',
                'color-bar-inferno': 'inferno',
                'color-bar-magma': 'magma',
                'color-bar-cividis': 'cividis',
                'color-bar-rainbow': 'rainbow',
                'color-bar-coolwarm': 'coolwarm'       
            };


            const colorBar = document.getElementById('colorBar');
            const colormap = colorBarNames[colorBar.classList[1]];
            //console.log(colormap);
            const colorMap = getColormap(colormap);
            const data = new Uint8ClampedArray(file.width * file.height * 4);
            let dataIndex = 0;

            for (let y = 0; y < file.height; y++) {
                for (let x = 0; x < file.width; x++) {
                    const normalizedValue = (file.matrix[y][x] - file.minValue) / (file.maxValue - file.minValue + 1e-9) ;

                    const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));

                    data[dataIndex++] = color.r;
                    data[dataIndex++] = color.g;
                    data[dataIndex++] = color.b;
                    data[dataIndex++] = 255;
                }
            }

            file.canvas = cnv;
            file.ctx = cnv.getContext('2d', { willReadFrequently: true });


            
            const imageData = new ImageData(data, file.width, file.height);
            file.ctx.putImageData(imageData, 0, 0);




            switchToFile(file.id);


            
            updateOpenFilesList();
        });
    }

    if (project.files.length > 0) {
        project.files.forEach((file, fileIndex) => {

            if (file.history && Array.isArray(file.history)) {
                file.history.forEach((historyItem, historyIndex) => {

                    // Создаем canvas элемент
                    const cnv = document.createElement('canvas');
                    cnv.className = 'paint-canvas';
                    cnv.id = `canvas-${file.id}`;
                    cnv.width = file.width;
                    cnv.height = file.height;
                    cnv.style.display = 'none';
                        
                    attachCanvasEvents(cnv);
                    document.getElementById('canvasHost').appendChild(cnv);
                        
                    const colorBarNames = {
                        'color-bar-gray': 'gray',
                        'color-bar-plasma': 'plasma',
                        'color-bar-inferno': 'inferno',
                        'color-bar-magma': 'magma',
                        'color-bar-cividis': 'cividis',
                        'color-bar-rainbow': 'rainbow',
                        'color-bar-coolwarm': 'coolwarm'       
                    };

                    const colorBar = document.getElementById('colorBar');
                    const colormap = colorBarNames[colorBar.classList[1]];
                    const colorMap = getColormap(colormap);
                    const data = new Uint8ClampedArray(file.width * file.height * 4);
                    let dataIndex = 0;


  

                    for (let y = 0; y < file.height; y++) {
                        for (let x = 0; x < file.width; x++) {

                            
                            const normalizedValue = (historyItem.matrix[y][x] - file.minValue) / (file.maxValue - file.minValue + 1e-9) ;
                            const color = colorMap(Math.max(0, Math.min(1, normalizedValue)));
                            data[dataIndex++] = color.r;
                            data[dataIndex++] = color.g;
                            data[dataIndex++] = color.b;
                            data[dataIndex++] = 255;
                        }
                    }
                    
                    
                    historyItem.canvas = cnv;
                    historyItem.ctx = cnv.getContext('2d', { willReadFrequently: true });
                    // console.log(data)
                    // console.log(file.width)
                    // console.log(file.height)
                    // console.log(file.minValue)
                    // console.log(file.maxValue)
                    const imageData = new ImageData(data, file.width, file.height);
                    historyItem.ctx.putImageData(imageData, 0, 0);

                    //console.log(project.files[0].history[1].ctx.getImageData(0, 0, project.files[0].history[1].canvas.width, project.files[0].history[1].canvas.height));
                    
                    historyItem.ctx = historyItem.ctx.getImageData(0, 0, historyItem.canvas.width, historyItem.canvas.height)
                    // switchToFile(file.id);
                    updateOpenFilesList();

                    // const jsonPretty = JSON.stringify(project, null, 2);
                    // console.log(jsonPretty); 
                
                });
            }
        });

        switchToFile(project.files[project.files.length-1].id);

        const file = project.files[project.files.length-1];
        restoreState(file, file.history[file.historyIndex]);
    }


    applySettingsTheme(project);

    initDomElements();

    updateToolInfo();
    // Инициализируем состояние кнопок при загрузке (когда файлов еще нет)
    updateButtonsState();

    initializeActivityTracking();

    initHelpButton();



    // Обработчик клика вне выпадающих списков
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('openFilesDropdown');
        const button = document.getElementById('openFilesDropdownBtn');
        
        if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
            //closeOpenFilesDropdown();
        }
        
        // // Закрытие панели фигур при клике вне её
        // if (dom.shapesPanel && !event.target.closest('#shapesBtn') && !event.target.closest('#shapesPanel')) {
        //     dom.shapesPanel.classList.remove('active');
        // }
    });


    // Глобальные обработчики событий
    document.addEventListener('keydown', handleKeyDown);    // определяется в events.js
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('mousemove', handleRadialMenuMouseMove); // обработчик движения мыши для радиального меню
    
    


    const genderRadios = document.querySelectorAll('.gender-radio');
    const actionArea = document.getElementById('action-area');
    
    // Получаем все инпуты внутри целевой области
    const targetInputs = actionArea.querySelectorAll('input');

    genderRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.value === 'male') {
                // Активируем поля
                targetInputs.forEach(input => {
                    input.disabled = false;
                });
                actionArea.classList.remove('disabled-inputs');
            } else {
                // Деактивируем поля
                targetInputs.forEach(input => {
                    input.disabled = true;
                });
                actionArea.classList.add('disabled-inputs');
            }
        });
    });




    // ============ Инициализация графика Plotly ============
    const plotlyDiv = document.getElementById('graphCanvas');
    if (plotlyDiv) {
        Plotly.newPlot(plotlyDiv, [{
            x: [], y: [],
            type: 'scatter',
            mode: 'lines',
            line: { color: 'rgb(220, 60, 80)', width: 2.2 }
        }], {
            title: { text: '', font: { size: 14 } },
            xaxis: { title: 'Пиксель вдоль линии' },
            yaxis: { 
                title: 'Интенсивность (R)',
                range: [0, 255],
                autorange: false
            },
            margin: { t: 30, l: 50, r: 35, b: 50 },
            showlegend: false,
            autosize: true
        }, { responsive: true, displayModeBar: false });
    }
}
// document.addEventListener('keydown', function(event) {
//     // Проверяем, что нажата именно F5
//     if (event.code === 'F5') {
//         // Игнорируем комбинации с Ctrl/Cmd/Alt, если нужно блокировать только чистый F5
//         // Если нужно блокировать и Ctrl+F5, удалите это условие (но будьте осторожны)
//         if (event.ctrlKey || event.metaKey || event.altKey) {
//             return; 
//         }

//         // Отменяем стандартное обновление страницы
//         event.preventDefault();
        
//         // Запрашиваем подтверждение
//         const isConfirmed = confirm('Вы уверены, что хотите обновить страницу?');
        
//         if (isConfirmed) {
//             // Пользователь подтвердил — выполняем обновление вручную
//             location.reload();
//         }
//         // Если отмена, ничего не делаем (страница не обновилась)
//     }
// });


window.addEventListener('beforeunload', function (event) {
    // Проверка: если нет несохраненных данных, ничего не делаем

  
    // Стандартный способ для современных браузеров
    event.preventDefault();
    event.returnValue = ''; // Обязательное действие для показа диалога
  
    // Для обратной совместимости с очень старыми браузерами
    return '';
  });



// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {

    DBDBD = await initDB();

    await initApp();
    await initHelpButton();

});

