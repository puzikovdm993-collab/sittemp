from flask import Flask, request, jsonify, render_template_string
from datetime import datetime
import json

app = Flask(__name__)

# Хранилище данных (в реальном проекте используйте базу данных)
saved_data = {}

# HTML-шаблон клиента (встроен для удобства)
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Авто-сохранение при бездействии</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        textarea, input[type="text"] {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            box-sizing: border-box;
        }
        textarea:focus, input[type="text"]:focus {
            outline: none;
            border-color: #4CAF50;
        }
        .status-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 15px;
            text-align: center;
            font-weight: bold;
            transition: all 0.3s ease;
            z-index: 1000;
        }
        .status-waiting {
            background-color: #fff3cd;
            color: #856404;
        }
        .status-saving {
            background-color: #cce5ff;
            color: #004085;
        }
        .status-success {
            background-color: #d4edda;
            color: #155724;
        }
        .status-error {
            background-color: #f8d7da;
            color: #721c24;
        }
        .countdown {
            font-size: 18px;
            margin-left: 10px;
        }
        .log-container {
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            max-height: 300px;
            overflow-y: auto;
        }
        .log-entry {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        .log-entry:last-child {
            border-bottom: none;
        }
        .log-time {
            color: #888;
            margin-right: 10px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <div id="statusBar" class="status-bar status-waiting">
        Ожидание активности... <span id="countdown" class="countdown">5</span> сек до сохранения
    </div>

    <div class="container">
        <h1>📝 Авто-сохранение при бездействии</h1>
        <p style="text-align: center; color: #666; margin-bottom: 30px;">
            Начните редактировать форму. Данные будут автоматически отправлены на сервер через 5 секунд после прекращения действий.
        </p>

        <form id="autoSaveForm">
            <div class="form-group">
                <label for="title">Заголовок:</label>
                <input type="text" id="title" name="title" placeholder="Введите заголовок..." data-autosave="true">
            </div>

            <div class="form-group">
                <label for="content">Содержание:</label>
                <textarea id="content" name="content" rows="8" placeholder="Введите текст..." data-autosave="true"></textarea>
            </div>

            <div class="form-group">
                <label for="author">Автор:</label>
                <input type="text" id="author" name="author" placeholder="Ваше имя..." data-autosave="true">
            </div>
        </form>

        <button onclick="forceSave()">💾 Сохранить сейчас</button>

        <div class="log-container">
            <h3>📋 Журнал событий:</h3>
            <div id="logContainer"></div>
        </div>
    </div>

    <script>
        // Конфигурация
        const INACTIVITY_DELAY = 5000; // 5 секунд
        const SERVER_URL = '/api/save';

        let inactivityTimer = null;
        let countdownInterval = null;
        let isSaving = false;
        let lastData = {};

        // Элементы DOM
        const statusBar = document.getElementById('statusBar');
        const countdownEl = document.getElementById('countdown');
        const logContainer = document.getElementById('logContainer');
        const form = document.getElementById('autoSaveForm');

        // Поля с автосохранением
        const autoSaveFields = document.querySelectorAll('[data-autosave="true"]');

        // Логирование
        function addLog(message, type = 'info') {
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.innerHTML = `<span class="log-time">[${timeStr}]</span>${message}`;
            
            if (type === 'error') {
                logEntry.style.color = '#dc3545';
            } else if (type === 'success') {
                logEntry.style.color = '#28a745';
            } else if (type === 'warning') {
                logEntry.style.color = '#ffc107';
            }
            
            logContainer.insertBefore(logEntry, logContainer.firstChild);
            
            // Ограничиваем количество записей
            while (logContainer.children.length > 50) {
                logContainer.removeChild(logContainer.lastChild);
            }
        }

        // Обновление статуса
        function updateStatus(status, countdown = null) {
            statusBar.className = 'status-bar';
            
            switch(status) {
                case 'waiting':
                    statusBar.classList.add('status-waiting');
                    statusBar.innerHTML = `Ожидание активности... <span id="countdown" class="countdown">${countdown}</span> сек до сохранения`;
                    break;
                case 'saving':
                    statusBar.classList.add('status-saving');
                    statusBar.innerHTML = '💾 Сохранение...';
                    break;
                case 'success':
                    statusBar.classList.add('status-success');
                    statusBar.innerHTML = '✅ Успешно сохранено!';
                    setTimeout(() => updateStatus('waiting', 5), 2000);
                    break;
                case 'error':
                    statusBar.classList.add('status-error');
                    statusBar.innerHTML = '❌ Ошибка сохранения!';
                    setTimeout(() => updateStatus('waiting', 5), 2000);
                    break;
            }
        }

        // Сбор данных формы
        function getFormData() {
            const data = {};
            autoSaveFields.forEach(field => {
                data[field.name] = field.value;
            });
            data.timestamp = new Date().toISOString();
            return data;
        }

        // Отправка данных на сервер
        async function sendDataToServer() {
            if (isSaving) return;
            
            const currentData = getFormData();
            
            // Проверяем, есть ли изменения
            if (JSON.stringify(currentData) === JSON.stringify(lastData)) {
                addLog('Нет изменений для отправки', 'info');
                return;
            }

            isSaving = true;
            updateStatus('saving');
            addLog('🚀 Отправка данных на сервер...', 'info');

            try {
                const response = await fetch(SERVER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(currentData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    lastData = currentData;
                    addLog('✅ Данные успешно сохранены на сервере', 'success');
                    addLog(`📅 Серверное время: ${result.server_time}`, 'info');
                    updateStatus('success');
                } else {
                    throw new Error(result.message || 'Ошибка сохранения');
                }
            } catch (error) {
                console.error('Ошибка сохранения:', error);
                addLog(`❌ Ошибка: ${error.message}`, 'error');
                updateStatus('error');
            } finally {
                isSaving = false;
            }
        }

        // Принудительное сохранение
        function forceSave() {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
            sendDataToServer();
        }

        // Сброс таймера бездействия
        function resetInactivityTimer() {
            if (isSaving) return;

            // Очищаем предыдущие таймеры
            if (inactivityTimer) {
                clearTimeout(inactivityTimer);
            }
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }

            // Запускаем обратный отсчет
            let secondsLeft = INACTIVITY_DELAY / 1000;
            updateStatus('waiting', secondsLeft);

            countdownInterval = setInterval(() => {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    clearInterval(countdownInterval);
                } else {
                    updateStatus('waiting', secondsLeft);
                }
            }, 1000);

            // Устанавливаем таймер отправки
            inactivityTimer = setTimeout(() => {
                sendDataToServer();
            }, INACTIVITY_DELAY);

            addLog('👤 Обнаружена активность пользователя', 'info');
        }

        // Навешиваем обработчики событий на поля ввода
        autoSaveFields.forEach(field => {
            field.addEventListener('input', resetInactivityTimer);
            field.addEventListener('change', resetInactivityTimer);
            field.addEventListener('focus', resetInactivityTimer);
        });

        // Дополнительные события активности
        document.addEventListener('click', resetInactivityTimer);
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('scroll', resetInactivityTimer);
        document.addEventListener('keypress', resetInactivityTimer);

        // Инициализация
        addLog('🎬 Приложение запущено. Начните редактирование формы.', 'info');
        addLog(`⏱️ Таймер бездействия установлен на ${INACTIVITY_DELAY/1000} секунд`, 'info');
        
        // Загружаем последние сохраненные данные (если есть)
        fetch('/api/load')
            .then(response => response.json())
            .then(data => {
                if (data && data.title) {
                    document.getElementById('title').value = data.title || '';
                    document.getElementById('content').value = data.content || '';
                    document.getElementById('author').value = data.author || '';
                    lastData = getFormData();
                    addLog('📥 Загружены последние сохраненные данные', 'success');
                }
            })
            .catch(error => {
                addLog('⚠️ Не удалось загрузить сохраненные данные', 'warning');
            });

        // Предупреждение при закрытии страницы с несохраненными данными
        window.addEventListener('beforeunload', (e) => {
            const currentData = getFormData();
            if (JSON.stringify(currentData) !== JSON.stringify(lastData)) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    """Главная страница с формой"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/save', methods=['POST'])
def save_data():
    """API endpoint для сохранения данных"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'Нет данных для сохранения'
            }), 400
        
        # Сохраняем данные в хранилище
        saved_data['latest'] = data
        saved_data['history'] = saved_data.get('history', [])
        saved_data['history'].append({
            'data': data,
            'saved_at': datetime.now().isoformat()
        })
        
        # Ограничиваем историю последними 10 записями
        if len(saved_data['history']) > 10:
            saved_data['history'] = saved_data['history'][-10:]
        
        print(f"💾 Данные сохранены: {json.dumps(data, ensure_ascii=False)}")
        
        return jsonify({
            'success': True,
            'message': 'Данные успешно сохранены',
            'server_time': datetime.now().isoformat(),
            'data_id': len(saved_data['history'])
        }), 200
        
    except Exception as e:
        print(f"❌ Ошибка сохранения: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Ошибка сервера: {str(e)}'
        }), 500

@app.route('/api/load', methods=['GET'])
def load_data():
    """API endpoint для загрузки последних сохраненных данных"""
    latest_data = saved_data.get('latest', {})
    return jsonify(latest_data), 200

@app.route('/api/history', methods=['GET'])
def get_history():
    """API endpoint для получения истории сохранений"""
    history = saved_data.get('history', [])
    return jsonify({
        'success': True,
        'history': history,
        'total_count': len(history)
    }), 200

if __name__ == '__main__':
    print("🚀 Запуск Flask сервера...")
    print("📱 Откройте в браузере: http://localhost:5000")
    print("⏱️ Таймер бездействия: 5 секунд")
    print("🛑 Для остановки нажмите Ctrl+C")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
