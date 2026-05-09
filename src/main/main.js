// import { initRecentFiles } from '/src/recentFiles/recentFiles.js'; // Абсолютный путь (лучше)
// import { handleKeyDown, handleWheel  } from '/src/events/events.js'; // Абсолютный путь (лучше)
// import { closeOpenFilesDropdown } from '/src/fileManager/fileManager.js'; // Абсолютный путь (лучше)

function initDomElements()                     // заполняет объект dom
{
    dom = {
        windowTitle: document.getElementById('windowTitle'),
        canvasHost: document.getElementById('canvasHost'),
        canvasWrapper: document.getElementById('canvasWrapper'),
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

async function loadProject(projectId) {
    const API_BASE_URL = window.location.origin;
    
    try {
        console.log(`🚀 Начало загрузки проекта ${projectId}...`);
        
        // Используем умную загрузку с кэшированием через IndexedDB
        // Схема: minio <=> indexeddb <=> браузер клиента
        const projectData = await ProjectDB.loadProjectWithCache(projectId, API_BASE_URL, true);
        
        console.log('✅ Проект загружен:', projectData);
        
        // Восстанавливаем проект из данных (с учётом openedFiles из IndexedDB)
        const restoredProject = createProjectFromData(projectData);
        window.project = restoredProject;
        
        console.log(`📂 Восстановлено файлов: ${restoredProject.files.length}`);
        if (restoredProject.files.length > 0) {
            console.log('📋 Открытые файлы:', restoredProject.files.map(f => f.filename));
            console.log('🎯 Активный файл:', window.activeFileId);
        }
        
        return restoredProject;
    } catch (error) {
        console.error("❌ Ошибка загрузки проекта:", error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');

    console.log("urlParams = " + urlParams);
    console.log("projectId = " + projectId);

    // Инициализация IndexedDB при загрузке страницы
    if (typeof ProjectDB !== 'undefined') {
        try {
            await ProjectDB.init();
            console.log('ProjectDB готов к работе');
        } catch (error) {
            console.error('Ошибка инициализации ProjectDB:', error);
        }
    }

    // Загружаем проект если указан projectId
    if (projectId) {
        loadProject(projectId)
            .then(restoredProject => {
                console.log("📄 restoredProject:", restoredProject);
                console.log("✅ Проект успешно восстановлен и готов к работе");

                initDomElements();
                
                updateToolInfo();
                // Инициализируем состояние кнопок при загрузке (когда файлов еще нет)
                updateButtonsState();
            })
            .catch(error => {
                console.error("❌ Не удалось загрузить проект:", error);
            });
    } else {
        // Если projectId не указан, просто инициализируем интерфейс
        initDomElements();
        updateToolInfo();
        updateButtonsState();
    }

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