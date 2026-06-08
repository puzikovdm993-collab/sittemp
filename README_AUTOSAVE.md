# Авто-сохранение при бездействии пользователя

Полноценный пример веб-приложения, которое отслеживает бездействие пользователя и автоматически отправляет данные на сервер через 5 секунд после прекращения активности.

## 📁 Структура проекта

```
/workspace/
├── autosave_server.py      # Flask сервер (Python)
├── requirements_autosave.txt # Зависимости Python
└── README_AUTOSAVE.md     # Этот файл
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
pip install -r requirements_autosave.txt
```

### 2. Запуск сервера

```bash
python autosave_server.py
```

### 3. Открытие в браузере

Перейдите по адресу: **http://localhost:5000**

## 🔧 Как это работает

### Клиентская часть (JavaScript)

1. **Отслеживание активности**: Скрипт мониторит следующие события:
   - Ввод текста в поля формы (`input`, `change`)
   - Клики мыши (`click`)
   - Движение мыши (`mousemove`)
   - Прокрутка страницы (`scroll`)
   - Нажатие клавиш (`keypress`)

2. **Таймер бездействия**: 
   - При обнаружении активности таймер сбрасывается
   - Запускается обратный отсчет (5 секунд)
   - Если в течение 5 секунд нет новой активности → отправка данных

3. **Визуальная индикация**:
   - 🟡 Желтый: Ожидание активности + обратный отсчет
   - 🔵 Синий: Сохранение данных
   - 🟢 Зеленый: Успешное сохранение
   - 🔴 Красный: Ошибка сохранения

4. **Оптимизация**:
   - Проверка на наличие изменений (не отправляет одинаковые данные)
   - Защита от повторной отправки во время сохранения
   - Журнал событий для отладки

### Серверная часть (Flask)

#### API Endpoints:

1. **`GET /`** - Главная страница с формой
2. **`POST /api/save`** - Сохранение данных
   ```json
   {
     "title": "Заголовок",
     "content": "Текст содержимого",
     "author": "Автор",
     "timestamp": "2024-01-01T12:00:00"
   }
   ```
   
   Ответ:
   ```json
   {
     "success": true,
     "message": "Данные успешно сохранены",
     "server_time": "2024-01-01T12:00:00",
     "data_id": 1
   }
   ```

3. **`GET /api/load`** - Загрузка последних сохраненных данных
4. **`GET /api/history`** - История всех сохранений (последние 10)

## 📝 Пример кода клиента

### Основные функции JavaScript:

```javascript
// Конфигурация
const INACTIVITY_DELAY = 5000; // 5 секунд

// Сброс таймера при активности
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);
    
    // Обратный отсчет
    let secondsLeft = INACTIVITY_DELAY / 1000;
    countdownInterval = setInterval(() => {
        secondsLeft--;
        updateStatus('waiting', secondsLeft);
    }, 1000);
    
    // Отправка через 5 секунд
    inactivityTimer = setTimeout(sendDataToServer, INACTIVITY_DELAY);
}

// Отправка данных на сервер
async function sendDataToServer() {
    const response = await fetch('/api/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData)
    });
    const result = await response.json();
}
```

## 🎯 Настройка таймера

Измените значение `INACTIVITY_DELAY` в файле `autosave_server.py`:

```javascript
const INACTIVITY_DELAY = 5000; // 5000 мс = 5 секунд
// Измените на нужное значение:
// 3000 = 3 секунды
// 10000 = 10 секунд
// 60000 = 1 минута
```

## 🔍 Тестирование

1. Откройте http://localhost:5000
2. Начните вводить текст в любое поле
3. Прекратите ввод и наблюдайте за обратным отсчетом
4. Через 5 секунд данные автоматически отправятся
5. Проверьте журнал событий внизу страницы
6. Посмотрите логи сервера в консоли

## 🛠️ Расширение функциональности

### Для реальной базы данных замените:

```python
# Вместо словаря saved_data
saved_data = {}

# Используйте SQLAlchemy или другую БД
from flask_sqlalchemy import SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///autosave.db'
db = SQLAlchemy(app)

class SavedData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    author = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### Добавьте аутентификацию:

```python
from flask_login import LoginManager, login_required

@app.route('/api/save', methods=['POST'])
@login_required
def save_data():
    # Только для авторизованных пользователей
    pass
```

## 📊 Преимущества подхода

✅ **Удобство для пользователя** - не нужно помнить о сохранении  
✅ **Экономия ресурсов** - отправка только при реальном бездействии  
✅ **Защита от потери данных** - автосохранение при случайном закрытии  
✅ **Гибкая настройка** - легко изменить таймер под свои нужды  
✅ **Визуальная обратная связь** - пользователь видит статус сохранения  

## ⚠️ Важные замечания

1. **Не используйте debug=True в продакшене**
2. **Настройте CORS** если фронтенд и бэкенд на разных доменах
3. **Добавьте валидацию данных** на сервере
4. **Используйте HTTPS** для защиты данных
5. **Реализуйте rate limiting** для защиты от спама

## 📄 Лицензия

Пример предоставлен для образовательных целей.
