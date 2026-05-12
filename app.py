import os
import sys
from datetime import datetime
from werkzeug.utils import secure_filename
import base64
import json
import logging

from dotenv import load_dotenv
from flask import Flask, request, jsonify, abort, send_from_directory


# ------------------- Настройка логирования -------------------
def setup_logging(app):
    # Для разработки (максимум деталей)
    app_logger_Level = logging.DEBUG
    console_handler_Level = logging.CRITICAL
    file_handler_Level = logging.DEBUG
    request_logger_Level = logging.DEBUG

    # Проверка и создание папки для логов (если её нет)
    if not os.path.exists('logs'):
        os.makedirs('logs')

    # Создаем логгер для основного приложения
    app_logger = logging.getLogger('FlaskAppLogger')
    app_logger.setLevel(app_logger_Level)

    # Создаем отдельный логгер для запросов
    request_logger = logging.getLogger('FlaskAppLogger.requests')
    request_logger.propagate = False
    request_logger.setLevel(request_logger_Level)

    # Формат логов
    app_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s : %(message)s',
        datefmt='%d.%m.%Y %H:%M:%S'
    )

    # Формат для логов запросов
    request_formatter = logging.Formatter(
        '[%(asctime)s] [REQUEST] %(levelname)s : %(message)s - %(module)s:%(funcName)s:%(lineno)d',
        datefmt='%d.%m.%Y %H:%M:%S'
    )

    # Создаем обработчик для обычных логов приложения
    app_file_handler = logging.FileHandler('logs/app.log')
    app_file_handler.setFormatter(app_formatter)
    app_file_handler.setLevel(app_logger_Level)
    app_logger.addHandler(app_file_handler)

    # Создаем отдельный обработчик для логов запросов
    request_file_handler = logging.FileHandler('logs/requests.log')
    request_file_handler.setFormatter(request_formatter)
    request_file_handler.setLevel(request_logger_Level)
    request_logger.addHandler(request_file_handler)
    
    # Логирование запросов через Flask-хуки
    @app.before_request
    def log_request():
        request_logger.info(f"Запрос: {request.method} {request.path} от {request.remote_addr}")
    
    @app.after_request
    def log_response(response):
        request_logger.debug(f"Ответ: {response.status} для {request.path}")
        return response
    
    return app_logger

# Инициализация Flask и логгера
app = Flask(__name__, static_folder='')
app_logger = setup_logging(app)
app_logger.info("Инициализировано Flask-приложение")


# Получаем путь к директории, где находится скрипт
if getattr(sys, 'frozen', False):
    # Если приложение упаковано в exe (PyInstaller)
    script_dir = os.path.dirname(sys.executable)
else:
    # Обычный режим выполнения
    script_dir = os.path.dirname(os.path.abspath(__file__))
    app_logger.debug(f"Приложение запущено в обычном режиме из директории: {script_dir}")

# Конфигурация
UPLOAD_FOLDER = os.path.join(script_dir, 'uploads')
ALLOWED_EXTENSIONS = {'tpt'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max-limit

# Создаем папку для загрузок, если она не существует
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app_logger.info(f"Папка для загрузок: {UPLOAD_FOLDER}")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_image_info(filename):
    """Получаем информацию об изображении"""
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return None
    
    stat = os.stat(filepath)
    created = datetime.fromtimestamp(stat.st_ctime).isoformat()
    modified = datetime.fromtimestamp(stat.st_mtime).strftime('%d.%m.%Y %H:%M')
    size = stat.st_size
    
    # Определяем тип файла
    file_type = 'unknown'
    if '.' in filename:
        file_type = filename.rsplit('.', 1)[1].lower()
    
    app_logger.debug(f"Информация о файле {filename}: размер={size}, тип={file_type}")
    return {
        'filename': filename,
        'original_filename': filename,
        'created': created,
        'modified': modified,
        'size': size,
        'type': file_type
    }


@app.route('/')
def index():
    if not os.path.exists('wtis-projects.html'):
        app_logger.error("Файл wtis-projects.html не найден")
        abort(404)
    return send_from_directory('.', 'wtis-projects.html')

@app.route('/api/user', methods=['GET'])
def get_user_info():
    """
    Возвращает информацию о пользователе, извлечённую из заголовка Authorization.
    Формат ответа: JSON с полем "login" (или "error" в случае ошибки).
    """
    headers = dict(request.headers)
    auth_header = headers.get('Authorization')

    if not auth_header:
        app_logger.error("Отсутствует заголовок Authorization")
        return jsonify({"error": "Неавторизованный запрос"}), 401

    try:
        # Извлекаем base64-кодированную часть (после "Basic ")
        auth_data = auth_header.split()[1]
        decoded_auth = base64.b64decode(auth_data).decode('utf-8')
        aut_login = decoded_auth.split(":")[0]  # Берём только логин (без пароля)

 
    except (IndexError, UnicodeDecodeError, base64.binascii.Error) as e:
        app_logger.error(f"Ошибка декодирования Authorization: {e}")
        return jsonify({"error": "Неверный формат заголовка Authorization"}), 400

    # Словарь для маппинга логинов (можно заменить на запрос к БД)
    login_translations = {
        "ganeevam": "Ганеев А.М.",
        "galinovivik": "Галинов И.В.",
        "pavloviv": "Павлов И.В.",
        "PavlovIV": "Павлов И.В.",
        "user2": "Пользователь2"
    }

    # Формируем ответ
    user_login = login_translations.get(aut_login, aut_login)
    return jsonify({
        "login": user_login,
        "original_login": aut_login,
        "authenticated": True
    }), 200


@app.route('/list_local')
def list_images():
    """Получить список всех изображений"""
    app_logger.info("Запрос списка изображений")
    try:
        images = []
        upload_folder = app.config['UPLOAD_FOLDER']
        
        # Проверяем существование папки
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)
            app_logger.warning(f"Папка {upload_folder} не существовала, создана автоматически")
        
        # Получаем список файлов
        for filename in os.listdir(upload_folder):
            if allowed_file(filename):
                info = get_image_info(filename)
                if info:
                    images.append(info)
        
        # Сортируем по дате создания (новые сначала)
        images.sort(key=lambda x: x['created'], reverse=True)
        app_logger.debug(f"Найдено {len(images)} изображений для отображения")
        
        return jsonify({
            'success': True,
            'images': images,
            'count': len(images)
        })
    except Exception as e:
        error_msg = f"Ошибка при получении списка изображений: {e}"
        app_logger.error(error_msg, exc_info=True)
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/image/<filename>')
def get_image(filename):
    """Получить изображение"""
    try:
        # Защищаем от path traversal атак
        filename = secure_filename(filename)
        upload_folder = app.config['UPLOAD_FOLDER']
        filepath = os.path.join(upload_folder, filename)

        if not os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404

        return send_from_directory(upload_folder, filename)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/upload', methods=['POST'])
def upload_image():
    """Загрузить изображение на сервер"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file part'
            }), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No selected file'
            }), 400

        if file and allowed_file(file.filename):
            # Защищаем имя файла
            original_filename = secure_filename(file.filename)

            # Добавляем timestamp, чтобы избежать конфликтов имен
            name, ext = os.path.splitext(original_filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{name}_{timestamp}{ext}"

            # Сохраняем файл
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)

            return jsonify({
                'success': True,
                'filename': unique_filename,
                'original_filename': original_filename,
                'message': 'File uploaded successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/upload_test', methods=['POST'])
def upload_file_test():
    try:

        id = request.form.get('id')
        filename = request.form.get('filename', 'UnnamedFile')
        autoscale = request.form.get('autoscale') == 'true'
        colormap = request.form.get('colormap', 'gray')
        width = int(request.form.get('width', 1))
        height = int(request.form.get('height', 1))
        min_value = float(request.form.get('minValue', 0))
        max_value = float(request.form.get('maxValue', 1))

        # Проверка параметров
        if width <= 0 or height <= 0:
            return jsonify({"error": "Width and height must be positive numbers"}), 400
        if not allowed_file(filename):
            return jsonify({"error": "Недопустимое расширение файла"}), 400

        matrix_file = request.files.get('matrix')
        if not matrix_file:
            return jsonify({"error": "Файл матрицы не найден"}), 400

        original_filename = matrix_file.filename
        matrix_filename = filename
        upload_folder = app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        matrix_path = os.path.join(upload_folder, matrix_filename)
        matrix_file.save(matrix_path)



        print(f"Получены данные:")
        print(f"ID: {id}")
        print(f"Файл: {filename}")
        print(f"Автоподстройка: {autoscale}")
        print(f"Колор-форма: {colormap}")
        print(f"Размер: [{width}, {height}]")
        print(f"Диапазон: [{min_value}, {max_value}]")
        print(f"matrix_path+matrix_filename: [{matrix_path}]")



        with open(matrix_path, 'r', encoding='utf-8') as file:
            data = file.read().strip().split(',')
            numbers = [float(x.strip()) for x in data]




        lines = [numbers[i:i+int(width)] for i in range(0, len(numbers), int(width))]


        with open(matrix_path, 'w', encoding='utf-8') as out_file:

            out_file.write(f"{int(width)}\n")
            out_file.write(f"{int(height)}\n")


            for line in lines:
                formatted_line = ' '.join(format(num, '.5f') for num in line)
                out_file.write(formatted_line + '\n')


        return jsonify({
            'success': True,
            'filename': filename,
            'original_filename': filename,
            'message': 'File uploaded successfully'
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/delete/<filename>', methods=['DELETE'])
def delete_image(filename):
    """Удалить изображение"""
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        if not os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404

        os.remove(filepath)
        return jsonify({
            'success': True,
            'message': 'File deleted successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/clear_all', methods=['DELETE'])
def clear_all_images():
    """Удалить все изображения"""
    try:
        count = 0
        upload_folder = app.config['UPLOAD_FOLDER']

        # Проверяем существование папки
        if not os.path.exists(upload_folder):
            return jsonify({
                'success': True,
                'message': 'No images to delete',
                'count': 0
            })

        for filename in os.listdir(upload_folder):
            if allowed_file(filename):
                filepath = os.path.join(upload_folder, filename)
                os.remove(filepath)
                count += 1

        return jsonify({
            'success': True,
            'message': f'Deleted {count} images',
            'count': count
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500





@app.route('/workflow')
def panel():
    # Отдаём workflow.html из корня проекта
    if not os.path.exists('workflow.html'):
        abort(404)
    return send_from_directory('.', 'workflow.html')

@app.route('/viewIcons')
def viewIcons():
    # Отдаём incon из корня проекта
    if not os.path.exists('icons-preview.html'):
        abort(404)
    return send_from_directory('.', 'icons-preview.html')

@app.route('/new_int')
def viewNewInterface():
    # Отдаём incon из корня проекта
    if not os.path.exists('test2_0.html'):
        abort(404)
    return send_from_directory('.', 'test2_0.html')


if __name__ == '__main__':

    # Запускаем сервер
    print(f"Server starting...")
    print(f"Script directory: {script_dir}")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Open http://127.0.0.1:15404 in your browser")
    app.run(debug=True, host='0.0.0.0', port=15404)
