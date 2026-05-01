// Альтернативная навигация - боковая выдвижная панель
const navigation = document.getElementById('sideNavigation');
const navToggle = document.getElementById('navToggle');
const navOverlay = document.getElementById('navOverlay');
const navItems = document.querySelectorAll('.nav-item');

// Функция открытия/закрытия навигации
function toggleNavigation() {
    navigation.classList.toggle('active');
    navOverlay.classList.toggle('visible');
    
    // Обновляем aria-expanded для доступности
    const isExpanded = navigation.classList.contains('active');
    navToggle.setAttribute('aria-expanded', isExpanded);
}

// Функция закрытия навигации
function closeNavigation() {
    navigation.classList.remove('active');
    navOverlay.classList.remove('visible');
    navToggle.setAttribute('aria-expanded', 'false');
}

// Обработчик клика на кнопку гамбургера
navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNavigation();
});

// Обработчик клика на оверлей (закрытие при клике вне панели)
navOverlay.addEventListener('click', () => {
    closeNavigation();
});

// Обработчики кликов на элементы навигации
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        // Убираем активный класс со всех элементов
        navItems.forEach(navItem => navItem.classList.remove('active'));
        
        // Добавляем активный класс текущему элементу
        item.classList.add('active');
        
        // Получаем действие
        const action = item.getAttribute('data-action');
        console.log('Выбрано действие:', action);
        
        // Здесь можно добавить логику для каждого действия
        // Например, вызов соответствующих функций
        
        // Закрываем навигацию после выбора (опционально)
        // closeNavigation();
    });
});

// Закрытие навигации при нажатии Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navigation.classList.contains('active')) {
        closeNavigation();
    }
});

// Предотвращаем всплытие клика внутри навигации
navigation.addEventListener('click', (e) => {
    e.stopPropagation();
});
