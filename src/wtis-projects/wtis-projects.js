// ---------- ПОЛНАЯ ЛОГИКА С ПОДДЕРЖКОЙ ДВУХ СТИЛЕЙ, ИЗБРАННЫМ, ЭКСПОРТОМ/ИМПОРТОМ, ПЛОТНОСТЬЮ, УЛУЧШЕННЫМ DND ----------
let projects = [];
let currentView = 'grid';
let currentSort = 'date-desc';
let currentAuthorFilter = 'all';
let currentTypeFilter = 'all';
const API_BASE_URL = window.location.origin;
let activeProjectId = null;
let draggedProjectId = null;
let dragPlaceholder = null;
let dragSourceCard = null;

let favoriteIds = JSON.parse(localStorage.getItem('favorite_projects') || '[]');

const sidebarListEl = document.getElementById('projectsGridMain');
const projectsGridMain = document.getElementById('projectsGridMain');
const projectsCountDisplay = document.getElementById('projectsCountDisplay');
const sidebarSearchInput = document.getElementById('sidebarSearchInput');
const newProjectName = document.getElementById('newProjectName');
const projectCategory = document.getElementById('projectCategory');
const projectType = document.getElementById('projectType');
const toastMsg = document.getElementById('toastMsg');
const userSettingsModal = document.getElementById('userSettingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const backToProjectsBtn = document.getElementById('backToProjectsBtn');
const settingsUserName = document.getElementById('settingsUserName');
const settingsUserRole = document.getElementById('settingsUserRole');
const settingsUiStyle = document.getElementById('settingsUiStyle');
const createProjectModal = document.getElementById('createProjectModal');
const openCreateProjectModalBtn = document.getElementById('openCreateProjectModalBtn');
const closeCreateProjectModalBtn = document.getElementById('closeCreateProjectModalBtn');
const createProjectModalBtn = document.getElementById('createProjectModalBtn');
const cancelCreateProjectModalBtn = document.getElementById('cancelCreateProjectModalBtn');
const displayUserNameSpan = document.getElementById('displayUserName');
const displayUserRoleSpan = document.getElementById('displayUserRole');
const statProjectsSpan = document.getElementById('sidebarSearchInput');
const statInProgressSpan = document.getElementById('statInProgress');
const statFavoritesSpan = document.getElementById('statFavorites');
const avatarLarge = document.querySelector('.avatar-small');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const mainSearchInput = document.getElementById('mainSearchInput');
const categoryFilter = document.getElementById('categoryFilter');
const typeFilter = document.getElementById('typeFilter');
const sortFilter = document.getElementById('sortFilter');
const emptyStateCreateBtn = document.getElementById('emptyStateCreateBtn');
const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
const tisSettingsModal = document.getElementById('tisSettingsModal');
const closeTisSettingsBtn= document.getElementById('closeTisSettingsBtn');
const cancelTisSettingsBtn= document.getElementById('cancelTisSettingsBtn');
const saveTisSettingsBtn = document.getElementById('saveTisSettingsBtn');
const authorFilterSelect = document.getElementById('authorFilter');
const typeFilterSelect = document.getElementById('typeFilter');

let confirmCallback = null;

// Улучшенная функция toast-уведомлений с типами и иконками
function showToast(msg, type = 'success', duration = 2500) {
    const iconMap = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    const icon = iconMap[type] || iconMap.success;
    
    //toastMsg.querySelector('.toast-icon').textContent = icon;
    toastMsg.querySelector('.toast-text').textContent = msg;
    toastMsg.className = 'toast-msg show ' + type;
    
    setTimeout(() => {
        toastMsg.classList.remove('show');
    }, duration);
}

// Функция показа модального окна подтверждения
function showConfirmModal(title, message, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.add('show');
}

// Функция скрытия модального окна подтверждения
function hideConfirmModal() {
    confirmModal.classList.remove('show');
    confirmCallback = null;
}

// Назначаем обработчик для кнопки подтверждения
confirmActionBtn.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    hideConfirmModal();
});

// Закрытие по клику вне модального окна
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        hideConfirmModal();
    }
});

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideConfirmModal();
    }
});

function saveFavorites() {
    localStorage.setItem('favorite_projects', JSON.stringify(favoriteIds));
    updateUserStatsUI();
    renderAll();
}

function toggleFavorite(projectId) {
    const idx = favoriteIds.indexOf(projectId);
    if (idx === -1) {
        favoriteIds.push(projectId);
        showToast('Добавлено в избранное', 'success');
    } else {
        favoriteIds.splice(idx, 1);
        showToast('Удалено из избранного', 'info');
    }
    saveFavorites();
}

async function loadProjectsFromMinIO() {
    try {
        const res = await fetch(`${API_BASE_URL}/list_projects`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        

        if (data.success && Array.isArray(data.projects)) {
            projects = data.projects;
            console.log(projects);
            
            for (let i = 0; i < projects.length; i++) {
                
                if (projects[i].order === undefined || projects[i].order === null) projects[i].order = i;
                // const original = projects.find(p => p.order === i);
                // console.log(original);
                console.log(projects);
            }
            console.log(projects);
            updateAuthorFilter();
            updateTypeFilter();
            projects.sort((a,b) => (a.order || 0) - (b.order || 0));
            return true;
        }
        return false;
    } catch(e) { return false; }
}
function updateAuthorFilter() {
    const authors = [...new Set(projects.map(p => p.owner || 'Неизвестно'))];
    authors.sort((a, b) => a.localeCompare(b, 'ru'));
    
    const currentValue = authorFilterSelect.value;
    authorFilterSelect.innerHTML = '<option value="all">Все авторы</option>';
    
    authors.forEach(author => {
        const option = document.createElement('option');
        option.value = author;
        option.textContent = author;
        authorFilterSelect.appendChild(option);
    });
    
    if (authors.includes(currentValue) || currentValue === 'all') {
        authorFilterSelect.value = currentValue;
    }
}

function updateTypeFilter() {
    const types = [...new Set(projects.map(p => p.type || 'Неизвестно'))];
    types.sort((a, b) => a.localeCompare(b, 'ru'));
    
    const currentValue = typeFilterSelect.value;
    typeFilterSelect.innerHTML = '<option value="all">Все проекты</option>';
    
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilterSelect.appendChild(option);
    });
    
    if (types.includes(currentValue) || currentValue === 'all') {
        typeFilterSelect.value = currentValue;
    }
}

async function loadlogin() {

    const API_BASE_URL = window.location.origin;
    
    fetch(`${API_BASE_URL}/api/user`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            return response.json(); // Парсинг JSON
        })
        .then(projects => {
            //console.log("projects:", projects.login);
            localStorage.setItem('userLogin', projects.login);  // Сохраняем в localStorage
        }) // Возвращаем данные проекта
        .catch(error => {
            console.error("Ошибка загрузки данных пользователя:", error);
        });
}

async function saveProjectToMinIO(project) {
    try {
        const res = await fetch(`${API_BASE_URL}/save_project`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ project }) });
        const data = await res.json();
        return data.success;
    } catch(e) { return false; }
}
async function deleteProjectFromMinIO(projectId) {
    try {
        const res = await fetch(`${API_BASE_URL}/delete_project/${projectId}`, { method: 'DELETE' });
        const data = await res.json();
        return data.success;
    } catch(e) { return false; }
}

function getFilteredProjects() {
    const term = sidebarSearchInput.value.trim().toLowerCase();
    let filtered = [...projects];
    if (term) filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    filtered.sort((a,b) => {
        const aFav = favoriteIds.includes(a.id);
        const bFav = favoriteIds.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return (a.order || 0) - (b.order || 0);
    });
    return filtered;
}
// ==================== Sorting ====================


function sortProjects(projectsList, sortType) {    
    const filtered = [...projectsList];

    switch (sortType) {

        case 'date-desc':
            filtered.sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                
                // Сравниваем даты (если a новее, чем b, то a должен идти первым)
                if (dateA > dateB) return -1;
                if (dateA < dateB) return 1;
                return 0;
            });
            break;
        case 'date-asc':
            filtered.sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                
                // Сравниваем даты (если a новее, чем b, то a должен идти первым)
                if (dateA > dateB) return 1;
                if (dateA < dateB) return -1;
                return 0;
            });
            break;
        case 'name-desc':
            filtered.sort((a, b) => {
                const nameA = a.name.toLowerCase(); // для регистронезависимой сортировки
                const nameB = b.name.toLowerCase();
                
                if (nameA < nameB) return 1;
                if (nameA > nameB) return -1; 
                return 0; 
            });
            break;
        case 'name-asc':
            filtered.sort((a, b) => {
                const nameA = a.name.toLowerCase(); // для регистронезависимой сортировки
                const nameB = b.name.toLowerCase();
                
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1; 
                return 0; 
            });
            break;
    }
    return filtered;
}
function sortProjects123(projectsList, sortType) {
    const sorted = [...projectsList];
    
    switch (sortType) {
        case 'date-desc':
            sorted.sort((a, b) => new Date(b.last_modified || b.createdAt || 0) - new Date(a.last_modified || a.createdAt || 0));
            break;
        case 'date-asc':
            sorted.sort((a, b) => new Date(a.last_modified || a.createdAt || 0) - new Date(b.last_modified || b.createdAt || 0));
            break;
        case 'name-asc':
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
            break;
        case 'name-desc':
            sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'ru'));
            break;
    }
    
    return sorted;
}

function getIconByType(type) { return type === "classic" ? "◧" : (type === "tis" ? "◨" : "◩"); }
function escapeHtml(str) { return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;')); }

function updateUserStatsUI() {
    statProjectsSpan.innerText = projects.length;
    const inProgress = projects.filter(p => p.deadline && p.deadline >= new Date().toISOString().slice(0,10)).length;
    // statInProgressSpan.innerText = inProgress;
    // statFavoritesSpan.innerText = favoriteIds.length;
}

function renderSidebarList() {
    const filtered = getFilteredProjects();
    sidebarListEl.innerHTML = '';
    if (filtered.length === 0) { sidebarListEl.innerHTML = '<div style="padding: 8px 16px; color: var(--text-secondary);">—</div>'; return; }
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'project-side-item';
        if (activeProjectId === p.id) div.classList.add('active-side');
        div.textContent = p.name;
        div.addEventListener('click', () => selectProject(p.id));
        sidebarListEl.appendChild(div);
    });
}

// ---------- DRAG & DROP ----------
function handleDragStart(e, projectId) {
    if (sidebarSearchInput.value.trim() !== '') { e.preventDefault(); showToast('✖ Снимите поиск для изменения порядка', true); return false; }
    draggedProjectId = projectId;
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
    dragSourceCard = e.target.closest('.project-card-main');
    if (dragSourceCard) dragSourceCard.classList.add('dragging');
    const dragImage = dragSourceCard.cloneNode(true);
    dragImage.style.opacity = '0.5';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
}

function handleDragEnd(e) {
    if (dragSourceCard) dragSourceCard.classList.remove('dragging');
    if (dragPlaceholder && dragPlaceholder.parentNode) dragPlaceholder.remove();
    dragPlaceholder = null;
    draggedProjectId = null;
    dragSourceCard = null;
    document.querySelectorAll('.project-card-main').forEach(card => card.classList.remove('drag-over-placeholder'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const grid = projectsGridMain;
    const afterElement = getDragAfterElement(grid, e.clientY);
    if (document.querySelector('.drag-placeholder') && afterElement !== document.querySelector('.drag-placeholder').nextSibling) {
        document.querySelector('.drag-placeholder')?.remove();
    }
    if (!dragPlaceholder) {
        dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'drag-placeholder';
        dragPlaceholder.style.height = (dragSourceCard ? dragSourceCard.offsetHeight : 80) + 'px';
        grid.insertBefore(dragPlaceholder, afterElement);
    } else if (afterElement) {
        grid.insertBefore(dragPlaceholder, afterElement);
    } else {
        grid.appendChild(dragPlaceholder);
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.project-card-main:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function handleDrop(e, targetProjectId = null) {
    e.preventDefault();
    if (!draggedProjectId) return;
    if (sidebarSearchInput.value.trim() !== '') { showToast('✖ Снимите поиск для изменения порядка', true); return; }
    const placeholder = document.querySelector('.drag-placeholder');
    if (!placeholder) return;
    const targetCard = placeholder.nextSibling?.classList?.contains('project-card-main') ? placeholder.nextSibling : null;
    let targetId = targetCard ? targetCard.getAttribute('data-id') : (placeholder.previousSibling?.getAttribute('data-id'));
    if (!targetId && targetProjectId) targetId = targetProjectId;
    if (!targetId) return;
    const sourceIndex = projects.findIndex(p => p.id === draggedProjectId);
    const targetIndex = projects.findIndex(p => p.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [movedProject] = projects.splice(sourceIndex, 1);
    const newIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    projects.splice(newIndex, 0, movedProject);
    for (let i = 0; i < projects.length; i++) projects[i].order = i;
    for (let p of projects) await saveProjectToMinIO(p);
    renderAll();
    showToast('Порядок сохранён');
    if (placeholder) placeholder.remove();
    dragPlaceholder = null;
    draggedProjectId = null;
}

// ---------- ОСНОВНЫЕ ДЕЙСТВИЯ С ПРОЕКТАМИ ----------
function selectProject(projectId) {
    const p = projects.find(project => project.id === projectId);
    if (!p) return;
    
    activeProjectId = projectId;
    renderSidebarList();
    renderMainGrid();
    showToast(p.name);
    
    setTimeout(() => {
        // Фиксированная часть URL
        let baseUrl = 'penpot-fusion.html';
        
        // Добавляем параметр projectId
        const urlWithParams = `${baseUrl}?projectId=${encodeURIComponent(projectId)}`;
        
        // Переопределяем URL в зависимости от типа проекта
        if (p.type === 'tis') {
            baseUrl = 'index.html';
        } else if (p.type === 'workflow') {
            baseUrl = 'workflow.html';
        }
        
        // Итоговый URL с параметром
        window.location.href = `${baseUrl}?projectId=${encodeURIComponent(projectId)}`;
        //console.log(`${baseUrl}?projectId=${encodeURIComponent(projectId)}`);
    }, 400);
}

/**
 * Форматирует текущую дату в строку вида "ДД-ММ-ГГГГ"
 * @returns {string} Дата в формате "28-04-2026"
 */
 function formatCurrentDateAsDDMMYYYY() {
    const createdAt = new Date().toISOString().slice(0, 10);
    const [year, month, day] = createdAt.split('-');
    return `${day}-${month}-${year}`;
}

/**
 * Форматирует текущую дату и время в строку вида "ГГГГ-ММ-ДД ЧЧ:ММ:СС"
 * @returns {string} Дата и время в формате "2026-04-28 15:14:05"
 */
function formatCurrentDateTimeAsYYYYMMDD_HHMMSS() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDate(now) {
    
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Месяцы в JS с 0 (январь = 0)
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return {
      short: `${day}-${month}-${year}`,
      full: `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`
    };
  }

async function createNewProject() {
    const name = newProjectName.value.trim();
    if(!name) { 
        showToast("укажите название", true); 
        alert('Ошибка: LiteGraph не загрузился. Проверьте соединение.');
        return; 
    }
    if(projects.some(p => p.name.toLowerCase() === name.toLowerCase())) { 
        showToast("проект существует", true); 
        return; 
    }
    const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
    const maxOrder = projects.length ? Math.max(...projects.map(p => p.order || 0)) : -1;
    const datanow = Date.now();

    const newProj = {
        id: newId, name, 
        type: projectType.value, 
        createdAt: datanow,
        lastUpdate:datanow,
        owner: displayUserNameSpan.innerText,
        order: maxOrder + 1
    };
    // Добавляем settings, только если type === 'tis'
    if (newProj.type === "tis") {
        newProj.settings = {  // Вложенный объект
            theme: "dark",
            notifications: true,
            defaultView: "list"
        };
    }
    console.log(newProj);
    const saved = await saveProjectToMinIO(newProj);
    if(!saved) { showToast("ошибка", true); return; }
    projects.push(newProj);
    newProjectName.value = '';
    activeProjectId = newId;
    sidebarSearchInput.value = '';
    renderAll();
    showToast(`✓ ${name}`);
    createProjectModal.classList.remove('show');
}

async function duplicateProject(projectId) {
    const original = projects.find(p => p.id === projectId);
    if(!original) return;
    const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
    const maxOrder = projects.length ? Math.max(...projects.map(p => p.order || 0)) : -1;
    const copy = { ...original, id: newId, name: `${original.name} (копия)`, createdAt: new Date().toISOString().slice(0,10), order: maxOrder + 1 };
    const saved = await saveProjectToMinIO(copy);
    if(saved) { projects.push(copy); renderAll(); showToast(`✓ дубль`); }
    else showToast("ошибка", true);
    closeAllMenus();
}

async function deleteProject(projectId) {
    const p = projects.find(p => p.id === projectId);
    if (!p) return;
    // Показываем модальное окно подтверждения вместо confirm()
    showConfirmModal(
        'Удаление проекта',
        `Вы уверены, что хотите удалить проект "${p.name}"? Это действие нельзя отменить.`,
        async () => {
            const deleted = await deleteProjectFromMinIO(projectId);
            if (!deleted) { 
                showToast("Ошибка при удалении", "error"); 
                return; 
            }
            projects = projects.filter(pr => pr.id !== projectId);
            favoriteIds = favoriteIds.filter(id => id !== projectId);
            saveFavorites();
            for (let i = 0; i < projects.length; i++) projects[i].order = i;
            for (let proj of projects) await saveProjectToMinIO(proj);
            if (activeProjectId === projectId) activeProjectId = null;
            renderAll();
            showToast(`Проект удалён`, "success");
        }
    );
    closeAllMenus();
}

function openProjectSettings(projectId) {
    const project  = projects.find(p => p.id === projectId);
    if(project && project .type === 'tis'){
        document.getElementById('settingsTISTheme').value = project.settings.theme;
        tisSettingsModal.setAttribute("project-Id", `${projectId}`);
        tisSettingsModal.classList.add('show');
    }
    closeAllMenus();
}

// ---------- ЭКСПОРТ / ИМПОРТ ОТДЕЛЬНОГО ПРОЕКТА ----------
function exportSingleProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_${project.name.replace(/[^a-z0-9]/gi, '_')}_${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Проект "${project.name}" экспортирован`);
    closeAllMenus();
}

async function importSingleProject(projectId) {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const imported = JSON.parse(text);
            // Проверяем, что это объект проекта (должен иметь id, name, category, type)
            if (!imported.id || !imported.name || !imported.category || !imported.type) {
                throw new Error('Невалидный файл проекта');
            }
            if (!confirm(`Заменить проект "${targetProject.name}" данными из файла?\nID проекта останется прежним (${targetProject.id}).`)) return;
            // Сохраняем старый ID и order, заменяем остальные поля
            const oldId = targetProject.id;
            const oldOrder = targetProject.order;
            const updatedProject = {
                ...imported,
                id: oldId,
                order: oldOrder,
                // если в импортированном нет createdAt, ставим текущий
                createdAt: imported.createdAt || new Date().toISOString().slice(0,10)
            };
            // Обновляем в массиве
            const index = projects.findIndex(p => p.id === oldId);
            if (index !== -1) projects[index] = updatedProject;
            // Сохраняем на сервер
            const saved = await saveProjectToMinIO(updatedProject);
            if (saved) {
                renderAll();
                showToast(`Проект "${updatedProject.name}" обновлён из файла`);
            } else {
                showToast('Ошибка сохранения', true);
            }
        } catch(err) {
            showToast('Неверный JSON файл проекта', true);
        }
        closeAllMenus();
    };
    input.click();
}

// ---------- ГЛОБАЛЬНЫЙ ЭКСПОРТ / ИМПОРТ (все проекты) ----------
function exportAllProjects() {
    const dataStr = JSON.stringify(projects, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `penpot_projects_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспорт всех проектов выполнен');
}

function importAllProjects() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const imported = JSON.parse(text);
            if (!Array.isArray(imported)) throw new Error();
            if (confirm('Заменить все текущие проекты? (Отмена — добавить)')) {
                projects = imported;
                favoriteIds = [];
            } else {
                projects.push(...imported);
            }
            for (let i = 0; i < projects.length; i++) {
                if (!projects[i].id) projects[i].id = 'proj_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2,4);
                projects[i].order = i;
            }
            for (let p of projects) await saveProjectToMinIO(p);
            renderAll();
            showToast('Импорт завершён');
        } catch(err) {
            showToast('Неверный JSON файл', true);
        }
    };
    input.click();
}

// ---------- ОТРИСОВКА ГЛАВНОЙ СЕТКИ ----------
function renderMainGrid() {
    const filtereds = getFilteredProjects();            
    let filteredProjects = filtereds;
    if (currentAuthorFilter !== 'all') {
        filteredProjects = filtereds.filter(p => (p.owner || 'Неизвестно') === currentAuthorFilter);
    }
    let filteredProjects1 = filteredProjects;
    if (currentTypeFilter !== 'all') {
        filteredProjects1 = filteredProjects.filter(p => (p.type || 'Неизвестно') === currentTypeFilter);
    }
    const filtered  = sortProjects(filteredProjects1,currentSort);

    projectsGridMain.innerHTML = '';
    if (filtered.length === 0) {
        projectsGridMain.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <h2 class="empty-state-title">У вас пока нет проектов</h2>
            <p class="empty-state-text">Создайте свой первый проект, чтобы начать работу</p>
        </div>
    `;       
    return;
    }
    filtered.forEach(project => {
        console.log(project.name);
        const card = document.createElement('div');
        card.className = 'project-card-main';
        card.setAttribute('data-id', project.id);
        const typeLabel = project.type === 'tis' ? 'tis' : 'workflow';
        // const deadlineText = project.deadline ? `⏱ ${project.deadline}` : '—';
        // const isClassic = document.body.classList.contains('classic');
        const isFavorite = favoriteIds.includes(project.id);
        
        const dragHandle = `<div class="drag-handle" draggable="true" style="display:none" data-id="${project.id}">⠿</div>`;
        const favoriteStar = `<button class="favorite-btn" style="display:none" data-id="${project.id}">${isFavorite ? '★' : '☆'}</button>`;
        
        card.innerHTML = `
            ${dragHandle}
            ${favoriteStar}
            <div class="card-header-icon">${getIconByType(project.type)}</div>
            <div class="card-title">${escapeHtml(project.name)}</div>
            <div class="card-meta">
                <span>${typeLabel}</span>
            </div>
            <div class="card-meta extra-meta">
                <span>📅 ${project.createdAt || '—'}</span>
            </div>
            <div class="card-meta extra-meta"><span>🧛🏽‍♂️ ${escapeHtml(project.owner)}</span></div>
            <button class="project-settings-btn" data-id="${project.id}">⋮</button>
            <div class="project-settings-menu" id="menu-${project.id}">
                <button class="project-settings-menu-item" onclick="window.openProjectSettings('${project.id}')">⚙️ Настройки</button>
                <button class="project-settings-menu-item" onclick="window.duplicateProject('${project.id}')">📑 Дублировать</button>
                <button class="project-settings-menu-item" onclick="window.exportSingleProject('${project.id}')">📤 Экспорт проекта</button>
                <button class="project-settings-menu-item" onclick="window.importSingleProject('${project.id}')">📥 Импорт проекта</button>
                <button class="project-settings-menu-item" onclick="window.deleteProject('${project.id}')" style="color: var(--danger);">💥 Удалить</button>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if(!e.target.closest('.project-settings-btn') && !e.target.closest('.drag-handle') && !e.target.closest('.project-settings-menu') && !e.target.closest('.favorite-btn')) 
                selectProject(project.id);
        });
        
        const settingsBtn = card.querySelector('.project-settings-btn');
        settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(project.id); });
        
        const favBtn = card.querySelector('.favorite-btn');
        favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(project.id); });
        
        const handle = card.querySelector('.drag-handle');
        handle.setAttribute('draggable', 'true');
        handle.addEventListener('dragstart', (e) => { handleDragStart(e, project.id); });
        handle.addEventListener('dragend', handleDragEnd);
        
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', (e) => {});
        card.addEventListener('drop', (e) => { handleDrop(e, project.id); });
        


        projectsGridMain.appendChild(card);
    });
}

function toggleMenu(id) { closeAllMenus(); const m = document.getElementById(`menu-${id}`); if(m) m.classList.toggle('show'); }
function closeAllMenus() { document.querySelectorAll('.project-settings-menu').forEach(m => m.classList.remove('show')); }

function renderAll() {
    renderMainGrid(); 
    updateUserStatsUI(); 
}


// --- Управление стилями и темой ---
function applyTheme(theme) {
    document.body.classList.remove('light');
    if(theme === 'light') document.body.classList.add('light');
    localStorage.setItem('user_theme', theme);
    renderAll();
}
function loadUserSettings() {
    const savedName = localStorage.getItem('userLogin');
    if(savedName) { 
        displayUserNameSpan.innerText = savedName; 
        document.getElementById("settingsUserName").textContent = savedName;
    }
    const theme = localStorage.getItem('user_theme') || 'dark';
    settingsUiStyle.value = theme;
    applyTheme(theme);
}
function saveUserSettingsFromModal() {
    applyTheme(settingsUiStyle.value);
    showToast("сохранено");
    userSettingsModal.classList.remove('show');
}
function saveTISSettingsFromModal() {
    const modalElement = document.getElementById('tisSettingsModal');
    const projectId = modalElement.getAttribute('project-id');
    const original = projects.find(proj => proj.id === projectId);
    const newTheme = document.getElementById('settingsTISTheme').value.trim();
    original.settings.theme = newTheme;
    saveProjectToMinIO(original);
    showToast("сохранено");
    tisSettingsModal.classList.remove('show');
}




function initEvents() {
    openCreateProjectModalBtn.onclick = () => createProjectModal.classList.add('show');
    closeCreateProjectModalBtn.onclick = () => createProjectModal.classList.remove('show');
    cancelCreateProjectModalBtn.onclick = () => createProjectModal.classList.remove('show');
    
    createProjectModalBtn.onclick = createNewProject;
    sidebarSearchInput.addEventListener('input', () => renderAll());
    avatarLarge.addEventListener('click', () => userSettingsModal.classList.add('show'));
    closeSettingsBtn.onclick = () => userSettingsModal.classList.remove('show');
    cancelSettingsBtn.onclick = () => userSettingsModal.classList.remove('show');
    saveSettingsBtn.onclick = saveUserSettingsFromModal;
    
    // Переключение режима просмотра (сетка/список)
    const toggleViewModeBtn = document.getElementById('toggleViewModeBtn');
    let isListView = false;
    toggleViewModeBtn.onclick = () => {
        isListView = !isListView;
        document.body.classList.toggle('view-mode-list', isListView);
        // toggleViewModeBtn.textContent = isListView ? '⊞' : '☰';


        toggleViewModeBtn.innerHTML = '';
  
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', isListView ? '#menu' : '#grid-2x2');
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(use);
        
        toggleViewModeBtn.appendChild(svg);




        // toggleViewModeBtn.title = isListView ? 'Сетка' : 'Список';
    };



    closeTisSettingsBtn.onclick = () => tisSettingsModal.classList.remove('show');
    cancelTisSettingsBtn.onclick = () => tisSettingsModal.classList.remove('show');
    saveTisSettingsBtn.addEventListener('click', () => saveTISSettingsFromModal());

    // Кнопка "назад" опциональна - навигация через хлебные крошки
    if (backToProjectsBtn) {
        backToProjectsBtn.onclick = () => document.querySelector('.main-content').scrollTo({top:0, behavior:'smooth'});
    }
    document.addEventListener('click', (e) => { if(!e.target.closest('.project-settings-btn') && !e.target.closest('.project-settings-menu')) closeAllMenus(); });
    createProjectModal.addEventListener('click', (e) => { if(e.target === createProjectModal) createProjectModal.classList.remove('show'); });
    userSettingsModal.addEventListener('click', (e) => { if(e.target === userSettingsModal) userSettingsModal.classList.remove('show'); });
    
    // document.getElementById('exportProjectsBtn').onclick = exportAllProjects;
    // document.getElementById('importProjectsBtn').onclick = importAllProjects;
    document.querySelectorAll('.density-btn').forEach(btn => {
        btn.addEventListener('click', () => setDensity(btn.dataset.density));
    });

    // Sort change
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderMainGrid();
    });

    // Author filter change
    authorFilterSelect.addEventListener('change', (e) => {
        currentAuthorFilter = e.target.value;
        renderMainGrid();
    });

    // type filter change
    typeFilterSelect.addEventListener('change', (e) => {
        currentTypeFilter = e.target.value;
        renderMainGrid();
    });


}



async function initUser() {
    const userLogin = localStorage.getItem('userLogin');
    if (userLogin == null) {
        console.log('Загрузка данных.');
        await loadlogin(); 
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    loadUserSettings();
}
async function init() {
    await initUser();

    await loadProjectsFromMinIO();
    
    if(projects.length > 0 && !activeProjectId) activeProjectId = projects[0].id;
    renderAll();
    initEvents();
}
init();

// Делаем функции глобальными для вызова из onclick в меню
window.openProjectSettings = openProjectSettings;
window.duplicateProject = duplicateProject;
window.deleteProject = deleteProject;
window.exportSingleProject = exportSingleProject;
window.importSingleProject = importSingleProject;