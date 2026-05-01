const navigation = document.querySelector(".navigation");
const closeBtn = document.querySelector(".navigation .close-btn");

// Открытие панели при клике на саму панель (когда она свернута)
navigation.addEventListener("click", (e) => {
  // Если клик не по кнопке закрытия и панель еще не активна - открываем
  if (!e.target.closest('.close-btn') && !navigation.classList.contains('active')) {
    navigation.classList.add('active');
  }
});

// Закрытие ТОЛЬКО при клике на центральную кнопку
if (closeBtn) {
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Предотвращаем всплытие, чтобы не сработал клик по navigation
    navigation.classList.remove('active');
  });
}