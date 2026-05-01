// Альтернативная навигация - боковое выдвижное меню (sidebar)
// Подключение: заменить в index.html ссылку на этот файл вместо navigation.js

document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const closeBtn = document.querySelector('.sidebar-close');
  const navLinks = document.querySelectorAll('.sidebar-nav a');

  // Открытие меню
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      sidebar.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
    });
  }

  // Закрытие меню кнопкой закрытия
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
  }

  // Закрытие меню кликом по затемнению
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Закрытие меню клавишей Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('active')) {
      closeSidebar();
    }
  });

  // Закрытие меню при клике на ссылку
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeSidebar();
    });
  });

  function closeSidebar() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Добавление активной ссылки
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });
});
