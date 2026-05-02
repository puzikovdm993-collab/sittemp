// Радиальное меню - JavaScript
const container = document.querySelector('.radial-menu');

let menuItems = container.querySelectorAll('.radial-menu__menu-item');
let menuItemsCount = countMenuItems(menuItems);

// Ссылки
let links = document.querySelectorAll('.radial-menu__menu-link');
setupLinks(links);
setupLinkHovers(links);

// Фон ссылок
let linkBGs = document.querySelectorAll('.radial-menu__menu-link-bg');
setupLinks(linkBGs);

// Иконки
let icons = document.querySelectorAll('.radial-menu__menu-icon');
let iconDistance = 95;
positionIcons(icons, iconDistance);

// Функция подсчета видимых элементов меню
function countMenuItems(elems) {
  var elemsCount = elems.length;
  var elemCounter = 0;

  for (var i = 0; i < elemsCount; i++) {
    var elem = elems[i];
    var elemDisplay = elem.currentStyle ? elem.currentStyle.display : getComputedStyle(elem, null).display;

    if (elemDisplay !== 'none') {
      elemCounter++;
    }
  }

  return elemCounter;
}

// Настройка ссылок
function setupLinks(elems) {
  var elemsCount = elems.length;
  var menuItems = container.querySelectorAll('.radial-menu__menu-item');
  var menuItemsCount = countMenuItems(menuItems);
  var degreeInterval = 360 / menuItemsCount;

  for (var i = 0; i < elemsCount; i++) {
    var elem = elems[i];
    var parentMenuItem = elem.parentElement;
    var parentMenuItemDisplay = parentMenuItem.currentStyle ? parentMenuItem.currentStyle.display : getComputedStyle(parentMenuItem, null).display;

    if (parentMenuItemDisplay !== 'none') {
      var cssTransform = 'translateY(-50%) translateZ(0) rotateZ(' + degreeInterval * i + 'deg) perspective(' + 300 / 1.5 + 'px)';
      var transformString = getLinkTransforms(menuItemsCount);
      cssTransform += transformString;
      elem.style.transform = cssTransform;
    }
  }
}

// Обработка наведения на ссылки
function setupLinkHovers(elems) {
  var elemsCount = elems.length;

  for (var i = 0; i < elemsCount; i++) {
    var elem = elems[i];
    var parentMenuItem = elem.parentElement;
    var parentMenuItemDisplay = elem.currentStyle ? elem.currentStyle.display : getComputedStyle(elem, null).display;

    if (parentMenuItemDisplay !== 'none') {
      elem.addEventListener('mouseenter', function(event) {
        var parentMenuItem = this.parentElement;
        parentMenuItem.classList.add('hovered');
        container.classList.add('item-is-hovered');
      });

      elem.addEventListener('mouseleave', function(event) {
        var parentMenuItem = this.parentElement;
        parentMenuItem.classList.remove('hovered');
        container.classList.remove('item-is-hovered');
      });
    }
  }
}

// Получение трансформаций для ссылок
function getLinkTransforms(count) {
  var transformString;

  switch (count) {
    case 3: 
      transformString = 'rotateY(-88.012deg) scaleX(1.45)';
      break;
    case 4:
      transformString = 'rotateY(-86.45deg) scaleX(1.425)';
      break;
    case 5:
      transformString = 'rotateY(-85.025deg) scaleX(1.39)';
      break;
    case 6:
      transformString = 'rotateY(-83.65deg) scaleX(1.36)';
      break;
    case 7:
      transformString = 'rotateY(-82.1deg) scaleX(1.325)';
      break;
    case 8:
      transformString = 'rotateY(-80.8deg) scaleX(1.3)';
      break;
    case 9:
      transformString = 'rotateY(-79deg) scaleX(1.265)';
      break;
    case 10:
      transformString = 'rotateY(-77.3deg) scaleX(1.23)';
      break;
    case 11:
      transformString = 'rotateY(-76deg) scaleX(1.21)';
      break;
    case 12:
      transformString = 'rotateY(-74.75deg) scaleX(1.185)';
      break;
    case 13:
      transformString = 'rotateY(-72.1deg) scaleX(1.14)';
      break;
    case 14:
      transformString = 'rotateY(-69.8deg) scaleX(1.11)';
      break;
    case 15:
      transformString = 'rotateY(-67.7deg) scaleX(1.086)';
      break;
    default:
      transformString = 'rotateY(-77.5deg) scaleX(1.25)';
  }

  return transformString;
}

// Позиционирование иконок
function positionIcons(icons, iconDistance) {
  var menuItems = container.querySelectorAll('.radial-menu__menu-item');
  var menuItemsCount = countMenuItems(menuItems);
  var iconsCount = icons.length;
  var iconOffset = 1.575;

  for (var i = 0; i < iconsCount; i++) {
    var icon = icons[i];
    var parentMenuItem = icon.parentElement;
    var parentMenuItemDisplay = parentMenuItem.currentStyle ? parentMenuItem.currentStyle.display : getComputedStyle(parentMenuItem, null).display;

    if (parentMenuItemDisplay !== 'none') {
      var phase = i / menuItemsCount;
      var theta = phase * 2 * Math.PI;
      theta = theta + iconOffset;

      icon.style.top = (-iconDistance * Math.cos(theta)).toFixed(1) + 'px';
      icon.style.left = (iconDistance * Math.sin(theta)).toFixed(1) + 'px';
    }
  }
}

// Правый клик - показать меню
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  var mousePosX = e.clientX;
  var mousePosY = e.clientY;

  container.classList.remove('is-hidden');
  container.classList.add('is-active');

  container.style.top = mousePosY + 'px';
  container.style.left = mousePosX + 'px';

  return false;
}, false);

// Отпускание кнопки мыши - скрыть меню
document.addEventListener('mouseup', function(e) {
  var mouseButton = e.button;

  if (mouseButton == 2) {
    container.classList.add('is-hidden');
    container.classList.remove('is-active');
  }
});