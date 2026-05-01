// Работа с недавними файлами (localStorage)


// Инициализация недавних файлов (вызывается при загрузке)
function initRecentFiles() {
    updateRecentFilesMenu();
    updateRecentFilesModal();
}

// Обновление меню в шапке
function updateRecentFilesMenu() {
    const container = document.getElementById('recentFilesList');
    if (!container) return;

    const files = getRecentFiles();
    container.innerHTML = '';

    if (files.length === 0) {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = 'Нет недавних файлов';
        container.appendChild(item);
        return;
    }

    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <span style="margin-right:8px">📄</span>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${file.name}
            </span>
            <span style="font-size:10px; color:#888; margin-left:8px;">
                ${formatRecentDate(file.openedAt)}
            </span>
        `;

        div.onclick = (e) => {
            e.stopPropagation();
            openRecentFile(file);
        };
        container.appendChild(div);
    });
}

// Обновить модальное окно недавних файлов
function updateRecentFilesModal() {
    const container = document.getElementById('recentFilesContainer');
    const countSpan = document.getElementById('recentFilesCount');
    if (!container) return;
    const recent = getRecentFiles();
    if (countSpan) countSpan.textContent = `Всего: ${recent.length}`;

    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Нет недавних файлов</div>';
        return;
    }

    let html = '';
    recent.forEach((file, idx) => {
        const date = file.lastModified ? new Date(file.lastModified).toLocaleString() : 'неизвестно';
        const size = file.size ? (file.size / 1024).toFixed(1) + ' KB' : '—';
        html += `
            <div class="recent-file-item" onclick="openRecentFile(${idx})" style="display:flex; align-items:center; padding:8px; border-bottom:1px solid #eee; cursor:pointer;">
                <div style="width:32px; height:32px; background:#f0f0f0; border:1px solid #ddd; margin-right:10px; display:flex; align-items:center; justify-content:center;">🖼️</div>
                <div style="flex:1;">
                    <div><strong>${file.name}</strong></div>
                    <div style="font-size:11px; color:#666;">${date} • ${size}</div>
                </div>
                <button class="file-close-btn" onclick="event.stopPropagation(); removeRecentFile(${idx})" title="Удалить из списка">✕</button>
            </div>
        `;
    });
    container.innerHTML = html;
}


// Получить список
function getRecentFiles() {
    try {
        const data = localStorage.getItem(RECENT_FILES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Ошибка чтения недавних файлов', e);
        return [];
    }
}

// Добавление файла в недавние (с защитой от больших файлов)
function addToRecentFiles(fileInfo) {
    try {
        let recent = getRecentFiles();

        // Удаляем дубликат, если уже есть
        recent = recent.filter(f => f.name !== fileInfo.name);

        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            name: fileInfo.name || 'Безымянный',
            lastModified: fileInfo.lastModified || Date.now(),
            size: fileInfo.size || 0,
            type: fileInfo.type || 'image/png',
            openedAt: new Date().toISOString()
        };

        // Сохраняем dataURL ТОЛЬКО если файл маленький (< 700 КБ)
        if (fileInfo.data && fileInfo.size < 700000) {
            entry.data = fileInfo.data;
        }

        recent.unshift(entry);

        if (recent.length > MAX_RECENT_FILES) recent.pop();

        localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
        updateRecentFilesMenu();
    } catch (err) {
        console.warn('Не удалось сохранить недавний файл (localStorage полный?)', err);
        // Очищаем старые записи и пробуем снова
        localStorage.setItem(RECENT_FILES_KEY, JSON.stringify([]));
    }
}



// function openRecentFile(file)
// function formatRecentDate(dateStr)
// function showRecentFilesModal()
// function clearRecentFiles()
// function removeRecentFile(index)



// Работа с недавними файлами (IndexedDB)
/**
 * Глобальная переменная AppDB для работы с IndexedDB
 */
// const AppDB = {
//     dbName: RECENT_FILES_KEY,
//     dbVersion: 1,
//     storeName: 'files',
//     db: null,

//     init() {
//         return new Promise((resolve, reject) => {
//             if (this.db) return resolve(this.db);

//             const request = indexedDB.open(this.dbName, this.dbVersion);

//             request.onupgradeneeded = (event) => {
//                 const db = event.target.result;
//                 if (!db.objectStoreNames.contains(this.storeName)) {
//                     const objectStore = db.createObjectStore(this.storeName, { 
//                         keyPath: 'id', 
//                         autoIncrement: true 
//                     });
//                     objectStore.createIndex('username', 'username', { unique: true });
//                 }
//             };

//             request.onsuccess = (event) => {
//                 this.db = event.target.result;
//                 resolve(this.db);
//             };
//             request.onerror = (event) => reject(event.target.errorCode);
//         });
//     },

//     async add(data) {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readwrite');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.add(data);
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });
//     },

//     async get(id) {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readonly');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.get(id);
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });
//     },

//     async getAll() {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readonly');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.getAll();
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });
//     },

//     async clear() {
//         await this.init();
//         return new Promise((resolve, reject) => {
//             const transaction = this.db.transaction([this.storeName], 'readwrite');
//             const store = transaction.objectStore(this.storeName);
//             const request = store.clear();
//             request.onsuccess = () => resolve();
//             request.onerror = () => reject(request.error);
//         });
//     }
// };

// Добавляем тестового пользователя
//     const userData = {
//     username: 'test_user_2',
//     settings: { theme: 'dark', lang: 'ru' },
//     created: new Date(),
//     permissions: ['read', 'write']
// };
// const id = AppDB.add(userData);
// console.log("id = "+id);
// console.log(AppDB.getAll());