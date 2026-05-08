// import { initRecentFiles } from '/src/recentFiles/recentFiles.js'; // Абсолютный путь (лучше)
// import { handleKeyDown, handleWheel  } from '/src/events/events.js'; // Абсолютный путь (лучше)
// import { closeOpenFilesDropdown } from '/src/fileManager/fileManager.js'; // Абсолютный путь (лучше)

function initDomElements()                     // заполняет объект dom
{
    dom = {
        windowTitle: document.getElementById('windowTitle'),
        canvasHost: document.getElementById('canvasHost'),
        canvasWrapper: document.getElementById('canvasWrapper'),
        toolsCanvas: document.getElementById('toolsCanvas'),
        cursorPos: document.getElementById('cursorPos'),
        canvasSize: document.getElementById('canvasSize'),
        zoomLevel: document.getElementById('zoomLevel'),
        shapesPanel: document.getElementById('shapesPanel'),
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

function loadProject(projectId) {
    const API_BASE_URL = window.location.origin;
    
    return fetch(`${API_BASE_URL}/load_project/${projectId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json(); // Парсинг JSON
        })
        .then(projects => {
            return projects.data;
        }) // Возвращаем данные проекта
        .catch(error => {
            console.error("Ошибка загрузки проекта:", error);
            throw error; // Пробрасываем ошибку для обработки вызывающим кодом
        });
}

document.addEventListener('DOMContentLoaded', function() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');

    // console.log("urlParams = " + urlParams);
    // console.log("projectId = " + projectId);

    // loadProject(projectId)
    // .then(projectData => {
        //console.log("projectData:",projectData);

        // project = Project.fromProjectData(projectData);
        // project = createProjectFromData(projectData);
        // console.log("Проект загружен:", project);
        // applySettingsTheme(project);

        initDomElements();
        // Инициализация при загрузке
        //AppDB.init().then(() => console.log('AppDB инициализирован'));

        updateToolInfo();
        // Инициализируем состояние кнопок при загрузке (когда файлов еще нет)
        updateButtonsState();





        // Обработчик клика вне выпадающих списков
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('openFilesDropdown');
            const button = document.getElementById('openFilesDropdownBtn');
            
            if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
                closeOpenFilesDropdown();
            }
            
            // Закрытие панели фигур при клике вне её
            if (dom.shapesPanel && !event.target.closest('#shapesBtn') && !event.target.closest('#shapesPanel')) {
                dom.shapesPanel.classList.remove('active');
            }
        });

        // Глобальные обработчики событий
        document.addEventListener('keydown', handleKeyDown);    // определяется в events.js
        document.addEventListener('wheel', handleWheel, { passive: false });
        document.addEventListener('mousemove', handleRadialMenuMouseMove); // обработчик движения мыши для радиального меню

    // })
    // .catch(error => {
    //     console.error("Не удалось загрузить проект:", error);
    // });


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








      




});

document.addEventListener('DOMContentLoaded', () => {
    const helpBtn = document.getElementById('helpBtn');

    function openHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.style.display = 'flex';
        }
    }

    if (helpBtn) {
        helpBtn.addEventListener('click', openHelp);
    }
    
    // Инициализация обработчика контекстного меню для canvasHost
    if (typeof attachCanvasHostEvents === 'function') {
        attachCanvasHostEvents();
    }
});