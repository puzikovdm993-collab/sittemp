import os
import sys
from io import BytesIO
from datetime import datetime
from werkzeug.utils import secure_filename
from minio import Minio
from minio.error import S3Error
import base64
import json
import io
import logging
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file, abort, send_from_directory,render_template, session, make_response




# ------------------- Настройка логирования -------------------
def setup_logging(app):  # Теперь функция принимает app как аргумент

    # #Для продакшена (минимум информации)
    # app_logger_Level = logging.WARNING          # Логгер игнорирует DEBUG и INFO
    # console_handler_Level = logging.WARNING     # Только WARNING, ERROR, CRITICAL в консоль
    # file_handler_Level = logging.INFO           # В файл записываются INFO и выше
    # request_logger_Level = logging.INFO     # Логируем запросы 

    # Для разработки (максимум деталей)
    app_logger_Level = logging.DEBUG     # Логгер собирает все уровни
    console_handler_Level = logging.CRITICAL # Всё выводится в консоль
    file_handler_Level = logging.DEBUG     # Всё записывается в файл
    request_logger_Level = logging.DEBUG     # Логируем запросы 


    # Проверка и создание папки для логов (если её нет)
    if not os.path.exists('logs'):
        os.makedirs('logs')


    # Создаем логгер для основного приложения
    app_logger = logging.getLogger('FlaskAppLogger')
    app_logger.setLevel(app_logger_Level)

    # Создаем отдельный логгер для запросов
    request_logger = logging.getLogger('FlaskAppLogger.requests')
    request_logger.propagate = False  # Отключаем передачу логов родительскому логгеру
    request_logger.setLevel(request_logger_Level)

    


    # Формат логов
    app_formatter = logging.Formatter(
        # #[25.02.2026 13:27:06] DEBUG в app.log_response: Ответ: 200 OK для /scripts/index.js
        # '[%(asctime)s] %(levelname)s в %(module)s.%(funcName)s: %(message)s',
        # datefmt='%d.%m.%Y %H:%M:%S'

        # [25.02.2026 13:27:06] DEBUG : Ответ: 200 OK для /scripts/index.js
        '[%(asctime)s] %(levelname)s : %(message)s',
        datefmt='%d.%m.%Y %H:%M:%S'
    )

    # Формат для логов запросов (более детализированный)
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
    
    # Добавляем обработчики
    # app_logger.addHandler(console_handler)
    # app_logger.addHandler(file_handler)
    # app_logger.addHandler(request_file_handler)
    
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
app_logger = setup_logging(app)  # Передаем app в функцию
app_logger.info("Инициализировано Flask-приложение")






minio_client = None  # Глобальная переменная (изначально None)

# Глобальные переменные для MinIO (будут загружены из .env при инициализации)
MINIO_ENDPOINT = None
MINIO_ACCESS_KEY = None
MINIO_SECRET_KEY = None
MINIO_REGION = None
MINIO_SECURE = None
MINIO_BUCKET = 'wtis'
MINIO_PROJECTS_PREFIX = 'projects/'  # Префикс для хранения проектов

def get_minio_client():
    global minio_client
    if minio_client is None:
        minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            region = MINIO_REGION,
            secure=MINIO_SECURE
        )
    return minio_client

def set_minio_client():
    """
    Инициализирует или переинициализирует MinIO-клиент, используя параметры из `.env` файла.
    Если `.env` не содержит необходимых переменных, применяются значения по умолчанию.
    
    Возвращает:
        Minio: клиент MinIO с параметрами из окружения или None если подключение не удалось
    
    Исключения:
        ValueError: если не найдены обязательные параметры
        ConnectionError: если подключение к MinIO не удалось
    """
    global minio_client, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_REGION, MINIO_SECURE
    
    # Загружаем переменные окружения из .env (если он есть)
    load_dotenv()

    # Получаем параметры из окружения (с дефолтами)
    endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    bucket = os.getenv("MINIO_BUCKET", "wtis")
    region = os.getenv("MINIO_REGION", "us-east-1")
    secure = os.getenv("MINIO_SECURE", "False").lower() == "true"
    
    # Проверяем обязательные параметры
    if not endpoint or not access_key or not secret_key:
        raise ValueError(
            "Необходимые параметры MinIO не найдены в окружении! "
            "Проверьте файл .env (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)."
        )
    
    # Сохраняем в глобальные переменные
    MINIO_ENDPOINT = endpoint
    MINIO_ACCESS_KEY = access_key
    MINIO_SECRET_KEY = secret_key
    MINIO_REGION = region
    MINIO_SECURE = secure
    MINIO_BUCKET = bucket
    
    try:
        # Создаём новый клиент
        minio_client = Minio(
            endpoint=endpoint,
            access_key=access_key,
            secret_key=secret_key,
            region=region,
            secure=secure
        )
        
        # Проверяем подключение
        minio_client.list_buckets()
        print("✅ MinIO клиент успешно инициализирован из .env!")
        return minio_client
    except Exception as e:
        print(f"⚠️ Не удалось подключиться к MinIO: {e}")
        print("Приложение будет работать в режиме только с IndexedDB (без синхронизации с MinIO)")
        minio_client = None
        return None



# ------------------- Декоратор для обработки ошибок MinIO -------------------
def handle_minio_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            app_logger.debug(f"Вызов функции {f.__name__} с аргументами: {args}, {kwargs}")
            return f(*args, **kwargs)
            app_logger.debug(f"Функция {f.__name__} завершена успешно")
        except S3Error as e:
            error_msg = f"Ошибка MinIO в {f.__name__}: {e}"
            app_logger.error(error_msg, exc_info=True)
            return jsonify({'error': e.message}), e.code if e.code else 500
        except Exception as e:
            error_msg = f"Внутренняя ошибка в {f.__name__}: {e}"
            app_logger.error(error_msg, exc_info=True)
            return jsonify({'error': 'Internal server error'}), 500
    return decorated_function


def ensure_bucket(client, bucket_name):
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            app_logger.info(f"Создан бакет {bucket_name} в MinIO")
    except S3Error as e:
        error_msg = f"Ошибка при создании бакета {bucket_name}: {e}"
        app_logger.error(error_msg)
        raise e











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

# @app.route('/')
# def index():
#     # app_logger.info("Доступ к главной странице")
#     # headers = dict(request.headers)
    
#     # # Проверка наличия заголовка Authorization
#     # auth_header = headers.get('Authorization')
#     # if not auth_header:
#     #     # Если заголовка нет, просто отдаем страницу (авторизация будет проверяться при действиях)
#     #     if not os.path.exists('index.html'):
#     #         app_logger.error("Файл index.html не найден")
#     #         abort(404)
#     #     return send_from_directory('.', 'index.html')
    
#     # try:
#     #     aut = base64.b64decode(auth_header.split()[1]).decode('utf-8')
#     #     login = aut.split(":")[0]
#     #     password = aut.split(":")[1]
#     #     app_logger.debug(f"login: {login}")
#     #     app_logger.debug(f"password: {password}")
#     # except Exception as e:
#     #     app_logger.error(f"Ошибка декодирования авторизации: {e}")
#     #     # Продолжаем без авторизации или можно вернуть 401
#     #     # abort(401)

#     login = "TEST_USER"

#     if not os.path.exists('wtis-projects.html'):
#         app_logger.error("Файл index.html не найден")
#         abort(404)
#     # return send_from_directory('.', 'wtis-projects.html')
#     return render_template('wtis-projects.html', login=login)

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

# curl  http://localhost:15404/list_minio
@app.route('/list_minio')
@handle_minio_errors
def list_objects():
    """Получить список объектов в бакете"""
    
    # Логируем входящий запрос
    app_logger.info(f"Запрос списка объектов в бакете '{MINIO_BUCKET}' MinIO")
    
    # Проверяем существование бакета
    try:
        bucket_exists = minio_client.bucket_exists(MINIO_BUCKET)
        app_logger.debug(f"Проверка бакета '{MINIO_BUCKET}': существует={bucket_exists}")
        
        if not bucket_exists:
            app_logger.warning(f"Бакет '{MINIO_BUCKET}' не существует.")
            return jsonify({'error': f'Bucket "{MINIO_BUCKET}" does not exist'}), 404
    except S3Error as e:
        app_logger.error(f"Ошибка проверки бакета: {e}", exc_info=True)
        raise
    
    # Получаем список объектов
    try:
        objects = minio_client.list_objects(MINIO_BUCKET, recursive=True)
        result = [
            {
                'name': obj.object_name,
                'size': obj.size,
                'last_modified': obj.last_modified.strftime('%Y-%m-%d %H:%M:%S'),
                'etag': obj.etag
            }
            for obj in objects
        ]
        app_logger.debug(f"Успешно получено {len(result)} объектов из бакета '{MINIO_BUCKET}'")
        
        # Логируем детали каждого объекта (уровень DEBUG)
        for obj in result:
            app_logger.debug(
                f"Объект: {obj['name']}, "
                f"Размер={obj['size']} байт, "
                f"Изменён={obj['last_modified']}"
            )
    except S3Error as e:
        app_logger.error(f"Ошибка получения списка объектов: {e}", exc_info=True)
        raise

    app_logger.info(f"Успешное получение списка объектов в бакете '{MINIO_BUCKET}' MinIO")
    return jsonify(result)


# curl -X POST  http://localhost:15404/upload_minio/test_tpt.json 
@app.route('/upload_minio', methods=['POST'])
@handle_minio_errors
def upload_minio():
    """Загрузить файл в MinIO, преобразовав его в JSON с base64-кодированием"""

    # Логируем входящий запрос с параметрами
    app_logger.info(f"Запрос загрузки файла в бакет '{MINIO_BUCKET}' MinIO")
    app_logger.debug(f"Получены параметры: filename={request.form.get('filename')}, "
                     f"autoscale={request.form.get('autoscale')}, "
                     f"colormap={request.form.get('colormap')}, "
                     f"width={request.form.get('width')}, "
                     f"height={request.form.get('height')}, "
                     f"minValue={request.form.get('minValue')}, "
                     f"maxValue={request.form.get('maxValue')}")

    # Получаем и проверяем параметры
    try:

        filename = request.form.get('filename', 'UnnamedFile')
        autoscale = request.form.get('autoscale') == 'true'
        colormap = request.form.get('colormap', 'gray')
        width = int(request.form.get('width', 1))
        height = int(request.form.get('height', 1))
        min_value = float(request.form.get('minValue', 0))
        max_value = float(request.form.get('maxValue', 1))

        # Логируем извлечённые параметры - уровень DEBUG
        app_logger.debug(
            f"Разобраны параметры: "
            f"filename={filename}, "
            f"autoscale={autoscale}, "
            f"colormap={colormap}, "
            f"width={width}, "
            f"height={height}, "
            f"min_value={min_value}, "
            f"max_value={max_value}"
        )
    except (ValueError, TypeError) as e:
        app_logger.error(f"Ошибка парсинга параметров: {e}", exc_info=True)
        return jsonify({"error": "Некорректные параметры запроса"}), 400

    # Проверяем наличие данных
    matrix_file = request.files.get('matrix')
    if not matrix_file:
        app_logger.warning("Файл матрицы не передан в запросе")
        return jsonify({"error": "Файл матрицы не найден"}), 400

    # Читаем содержимое файла
    try:
        file_content = matrix_file.read().decode('utf-8')  # Читаем и декодируем в строку
        app_logger.debug(f"Файл '{filename}' успешно прочитан (длина={len(file_content)} символов)")
    except UnicodeDecodeError as e:
        app_logger.error(f"Ошибка декодирования файла: {e}", exc_info=True)
        return jsonify({"error": "Файл должен быть в формате UTF-8"}), 400

    # Проверка параметров
    if width <= 0 or height <= 0:
        app_logger.warning(f"Некорректные размеры: width={width}, height={height}")
        return jsonify({"error": "Width and height must be positive numbers"}), 400

    # Кодируем содержимое в base64
    try:
        b64_content = base64.b64encode(file_content.encode('utf-8')).decode('utf-8')
        app_logger.debug(f"Файл '{filename}' успешно преобразован в base64")
    except Exception as e:
        app_logger.error(f"Ошибка base64-кодирования: {e}", exc_info=True)
        return jsonify({"error": "Ошибка обработки файла"}), 500

    # Формируем JSON-объект
    try:
        json_payload = {
            'filename': filename,
            'autoscale': autoscale,
            'colormap': colormap,
            'width': width,
            'height': height,
            'min_value': min_value,
            'max_value': max_value,
            'b64_content': b64_content
        }
        
        json_str = json.dumps(json_payload, indent=2)
        json_bytes = json_str.encode('utf-8')
        app_logger.debug(f"Создан JSON-объект для файла {filename}")
    except Exception as e:
        app_logger.error(f"Ошибка создания JSON-объекта: {e}", exc_info=True)
        return jsonify({"error": "Ошибка формирования JSON"}), 500


    # Получаем клиент MinIO и проверяем бакет
    try:
        client = get_minio_client()
        ensure_bucket(client, MINIO_BUCKET)
        app_logger.debug(f"Подключён клиент MinIO, бакет '{MINIO_BUCKET}' существует")
    except S3Error as e:
        app_logger.error(f"Ошибка подключения к MinIO или проверки бакета: {e}", exc_info=True)
        raise


    # Имя объекта в MinIO (меняем расширение на .json)
    object_name = f"{filename}.json"
    app_logger.debug(f"Подготовлено имя объекта в MinIO: {object_name}")


    try:
        # Загружаем в MinIO как JSON
        data_stream = io.BytesIO(json_bytes)
        client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=data_stream,
            length=len(json_bytes),
            content_type='application/json'
        )

        app_logger.info(f"Файл '{filename}' успешно загружен как {object_name}")

        return jsonify({
            'success': True,
            'message': 'File uploaded, converted to base64 and saved as JSON',
            'bucket': MINIO_BUCKET,
            'object': object_name
        }), 200

    except S3Error as e:
        app_logger.error(f"Ошибка загрузки в MinIO: {e}", exc_info=True)
        return jsonify({'error': f"MinIO storage error: {e}"}), 500
    except Exception as e:
        app_logger.error(f"Неожиданная ошибка при загрузке: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500



# curl -X GET  http://localhost:15404/download_minio/test_tpt.json 
@app.route('/download_minio/<object_name>', methods=['GET'])
@handle_minio_errors
def download_file_minio(object_name):
    """
    Скачивает файл из MinIO по имени JSON-объекта.
    """
    # Логируем входящий запрос
    app_logger.info(f"Запрос скачивания объекта '{object_name}' из бакета '{MINIO_BUCKET}' MinIO")
    app_logger.debug(f"Запрошено скачивание объекта: {object_name}")

    # Проверяем существование бакета
    try:
        bucket_exists = minio_client.bucket_exists(MINIO_BUCKET)
        app_logger.debug(f"Проверка бакета '{MINIO_BUCKET}': существует={bucket_exists}")
        
        if not bucket_exists:
            app_logger.warning(f"Бакет '{MINIO_BUCKET}' не существует.")
            return jsonify({'error': f'Bucket "{MINIO_BUCKET}" does not exist'}), 404
    except S3Error as e:
        app_logger.error(f"Ошибка проверки бакета: {e}", exc_info=True)
        raise


    try:
        # Получаем объект как поток
        response = minio_client.get_object(MINIO_BUCKET, object_name)
        app_logger.debug(f"Объект '{object_name}' загружен")
    
        # Декодируем и парсим JSON
        json_data = json.loads(response.read().decode('utf-8'))
        app_logger.debug(f"Успешный парсинг JSON. Ключи: {list(json_data.keys())}")

        matrix = base64.b64decode(json_data['b64_content']).decode('utf-8')
        app_logger.debug( f"Декодирована base64-матрица из объекта '{object_name}' " )

        app_logger.info(f"Файл '{json_data['filename']}' успешно скачан из объекта '{object_name}' " )

        # Возвращаем имя файла в JSON (или другом формате)
        return jsonify({
            "status": "success",
            "filename": json_data['filename'],
            "autoscale": json_data['autoscale'],
            "colormap": json_data['colormap'],
            "width": json_data['width'],
            "height": json_data['height'],
            "min_value": json_data['min_value'],
            "max_value": json_data['max_value'],
            "matrix": matrix
        })
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Объект '{object_name}' не найден в бакете '{MINIO_BUCKET}'")
            return jsonify({'error': f'Object "{object_name}" not found'}), 404
        else:
            app_logger.error(f"Ошибка доступа к объекту в MinIO: {e}", exc_info=True)
            return jsonify({'error': f"MinIO storage error: {e}"}), 500
    
    except UnicodeDecodeError as e:
        app_logger.error(f"Ошибка декодирования JSON или base64: {e}", exc_info=True)
        return jsonify({'error': "Не удалось декодировать данные объекта"}), 500
    
    except json.JSONDecodeError as e:
        app_logger.error(f"Ошибка парсинга JSON: {e}", exc_info=True)
        return jsonify({'error': "Некорректный формат JSON в объекте"}), 500
    
    except KeyError as e:
        app_logger.error(f"Отсутствует обязательный ключ в JSON: {e}", exc_info=True)
        return jsonify({'error': f"Отсутствует обязательное поле: {e}"}), 400
    
    except Exception as e:
        app_logger.error(f"Неожиданная ошибка при скачивании: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500




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
        
        return send_file(filepath)
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
        # matrix_filename = secure_filename(filename)
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



@app.route('/move', methods=['POST'])
@handle_minio_errors
def move_object():
    data = request.get_json()
    if not data or 'source' not in data or 'destination' not in data:
        return jsonify({'error': 'Отсутствие источника или адресата'}), 400

    source = data['source']
    destination = data['destination']

    app_logger.info(f"Попытка перемещения {source} -> {destination}")

    # Проверка существования исходного объекта
    try:
        minio_client.stat_object(MINIO_BUCKET, source)
    except Exception as e:
        app_logger.error(f"Исходный объект не найден.: {source} - {e}")
        return jsonify({'error': f'Исходный объект не найден.: {str(e)}'}), 404

    # Копирование с использованием CopySource
    try:


        # copy_source = {'Bucket': MINIO_BUCKET, 'Object': source}   # для версий ≤6.x
        copy_source = CopySource(
            bucket_name=MINIO_BUCKET,  # Бакет исходного объекта
            object_name=source  # Ключ исходного объекта
        )
        print(f"MINIO_BUCKET: {MINIO_BUCKET}")
        print(f"destination: {destination}")
        print(f"copy_source: {copy_source}")
        minio_client.copy_object(MINIO_BUCKET, destination, copy_source)
        app_logger.info(f"Успешное выполнение: Объект скопирован. {source} в {destination}")
    except Exception as e:
        app_logger.error(f"Ошибка копирования: {source} -> {destination} - {e}")
        return jsonify({'error': f'Ошибка копирования: {str(e)}'}), 500

    # Удаление исходного объекта
    try:
        minio_client.remove_object(MINIO_BUCKET, source)
        app_logger.info(f"Исходный объект удалён {source}")
    except Exception as e:
        app_logger.error(f"Не удалось удалить исходный объект {source} после копирования: {e}")
        return jsonify({
            'error': f'Copy succeeded but failed to remove original: {str(e)}',
            'warning': 'Original file still exists, please check manually'
        }), 500

    return jsonify({'success': True, 'source': source, 'destination': destination})

@app.route('/mkdir_minio', methods=['POST'])
@handle_minio_errors
def mkdir_minio():
    """
    Создаёт пустой объект-маркер, имитирующий папку.
    Ожидает JSON: { "prefix": "newfolder/" }
    """
    data = request.get_json()
    if not data or 'prefix' not in data:
        return jsonify({'error': 'Missing prefix'}), 400

    prefix = data['prefix'].strip()
    # Убедимся, что префикс оканчивается на '/'
    if not prefix.endswith('/'):
        prefix += '/'

    # Проверка на допустимость (запрещаем '..')
    if '..' in prefix or prefix.startswith('/'):
        return jsonify({'error': 'Invalid folder name'}), 400

    try:
        # Создаём пустой объект
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=prefix,
            data=io.BytesIO(b''),
            length=0,
            content_type='application/x-directory'  # опционально
        )
        return jsonify({'success': True, 'prefix': prefix}), 201
    except S3Error as e:
        app.logger.error(f"Error creating folder {prefix}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_minio', methods=['DELETE'])
@handle_minio_errors
def delete_minio():
    """
    Удаляет объект или все объекты с указанным префиксом.
    Параметры: ?path=some/path   (если оканчивается на '/', удаляется папка)
    """
    path = request.args.get('path')
    if not path:
        return jsonify({'error': 'Missing path parameter'}), 400

    # Базовая защита
    if '..' in path or path.startswith('/'):
        return jsonify({'error': 'Invalid path'}), 400

    try:
        if path.endswith('/'):
            # Удаление папки (все объекты с префиксом)
            objects_to_delete = list(minio_client.list_objects(
                MINIO_BUCKET, prefix=path, recursive=True
            ))
            if not objects_to_delete:
                return jsonify({'error': 'Folder not found or empty'}), 404

            # Формируем список имён для массового удаления
            delete_object_list = [obj.object_name for obj in objects_to_delete]
            errors = minio_client.remove_objects(
                MINIO_BUCKET,
                delete_object_list,
                bypass_governance_mode=True
            )
            # Проверим, были ли ошибки
            failed = list(errors)
            if failed:
                app.logger.error(f"Errors while deleting folder {path}: {failed}")
                return jsonify({
                    'success': False,
                    'error': 'Some objects could not be deleted',
                    'details': failed
                }), 500

            return jsonify({
                'success': True,
                'deleted_count': len(delete_object_list),
                'message': f'Folder {path} deleted'
            })
        else:
            # Удаление одного файла
            minio_client.remove_object(MINIO_BUCKET, path)
            return jsonify({
                'success': True,
                'deleted_count': 1,
                'message': f'File {path} deleted'
            })
    except S3Error as e:
        app.logger.error(f"Error deleting {path}: {e}")
        return jsonify({'error': str(e)}), 500









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


def is_prefix_explicitly_created(minio_client, bucket_name, prefix):
    try:
        minio_client.stat_object(bucket_name, prefix.strip('/') + '/')
        return True  # Папка существует как отдельный объект
    except S3Error as e:
        if e.code == "NoSuchKey":
            return False  # Папка не создана явно
        else:
            print(f"Ошибка: {e}")
            return False

# curl  http://localhost:15404/endpointtest
@app.route('/endpointtest')
def endpointtest():
    bucket_name = "wtis"
    prefix = "123/123"

    try:
        # Проверяем, есть ли объекты с этим префиксом (или сам префикс)
        if is_prefix_explicitly_created(minio_client,bucket_name,prefix):
            print(f"Префикс '{prefix}' существует и не пуст.")
        else:
            print(f"нет Префикс '{prefix}' .")
        # /objects = minio_client.list_objects(bucket_name, prefix=prefix, recursive=True)

        


    except S3Error as e:
        print(f"Ошибка: {e}")

    return "Тестовый ответ", 200  # или просто return "OK"


# ==================== Project Management Endpoints ====================

@app.route('/save_project/<project_id>', methods=['POST'])
def save_project(project_id):
    """
    Сохраняет проект в MinIO в формате JSON.
    Ожидает JSON с данными проекта (напрямую или в поле 'project').
    project_id берётся из URL пути.
    """
    # Проверяем доступность MinIO
    if minio_client is None:
        app_logger.warning(f"MinIO недоступен. Проект {project_id} сохранён только в IndexedDB")
        return jsonify({
            'success': True,
            'project_id': project_id,
            'message': 'Project saved to IndexedDB only (MinIO unavailable)',
            'minio_available': False
        }), 200
    
    app_logger.info(f"Запрос на сохранение проекта {project_id} в MinIO")
    
    # Получаем данные проекта из запроса
    data = request.get_json()
    if not data:
        app_logger.error(f"error: No JSON data provided  400")
        return jsonify({'error': 'No JSON data provided'}), 400

    # Данные проекта могут приходить напрямую или в поле 'project'
    if 'project' in data:
        project_data = data['project']
    else:
        project_data = data

    # Проверяем, что ID в данных совпадает с ID в URL (если есть в данных)
    data_project_id = project_data.get('id')
    if data_project_id and data_project_id != project_id:
        app_logger.warning(f"Несоответствие project_id: в URL={project_id}, в данных={data_project_id}")
    
    # Формируем имя объекта в MinIO
    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}.json"
    
    # Преобразуем данные в JSON (используем project_data)
    try:
        json_str = json.dumps(project_data, ensure_ascii=False, indent=2)
        json_bytes = json_str.encode('utf-8')
        app_logger.debug(f"Проект {project_id} сериализован в JSON (размер={len(json_bytes)} байт)")
    except Exception as e:
        app_logger.error(f"Ошибка сериализации проекта: {e}", exc_info=True)
        return jsonify({'error': 'Failed to serialize project data'}), 500
    
    # Гарантируем существование бакета
    try:
        ensure_bucket(minio_client, MINIO_BUCKET)
    except Exception as e:
        app_logger.error(f"Ошибка создания бакета: {e}", exc_info=True)
        return jsonify({'error': 'Failed to ensure bucket exists'}), 500
    
    # Загружаем в MinIO
    try:
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type='application/json'
        )
        app_logger.info(f"Проект {project_id} успешно сохранён в MinIO: {object_name}")
        
        return jsonify({
            'success': True,
            'project_id': project_id,
            'object_name': object_name,
            'message': f'Project saved successfully',
            'minio_available': True
        }), 201
    except S3Error as e:
        app_logger.error(f"Ошибка сохранения проекта в MinIO: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# curl -X GET  http://localhost:15404/load_project/proj_1777373741280_8nnowm
@app.route('/load_project/<project_id>', methods=['GET'])
@handle_minio_errors
def load_project(project_id):
    """
    Загружает проект из MinIO по его ID.
    Возвращает JSON с данными проекта.
    """
    app_logger.info(f"Запрос на загрузку проекта {project_id} из MinIO")
    
    # Формируем имя объекта в MinIO
    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}.json"
    
    try:
        # Получаем объект из MinIO
        response = minio_client.get_object(MINIO_BUCKET, object_name)
        
        # Читаем данные
        json_str = response.read().decode('utf-8')
        response.close()
        response.release_conn()
        
        # Парсим JSON
        project_data = json.loads(json_str)
        
        # Убеждаемся, что у проекта есть поле id для корректного сохранения в IndexedDB
        if 'id' not in project_data or not project_data['id']:
            app_logger.info(f"Добавляем поле id в проект {project_id}")
            project_data['id'] = project_id
            project_data['projectId'] = project_id
        
        app_logger.info(f"Проект {project_id} успешно загружен из MinIO")

        return jsonify({
            'success': True,
            'data': project_data
        }), 200
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Проект {project_id} не найден в MinIO")
            return jsonify({'error': f'Project {project_id} not found'}), 404
        app_logger.error(f"Ошибка загрузки проекта из MinIO: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/list_projects', methods=['GET'])
@handle_minio_errors
def list_projects():
    """
    Возвращает список всех проектов в MinIO с полными данными.
    """
    app_logger.info("Запрос списка проектов из MinIO")
    
    try:
        # Получаем список объектов с префиксом проектов
        objects = minio_client.list_objects(MINIO_BUCKET, prefix=MINIO_PROJECTS_PREFIX, recursive=True)
        
        projects = []
        for obj in objects:
            # Пропускаем объекты-папки (заканчиваются на /)
            if obj.object_name.endswith('/'):
                continue
            
            # Извлекаем ID проекта из имени файла
            filename = obj.object_name.split('/')[-1]
            if filename.endswith('.json'):
                project_id = filename[:-5]  # Убираем .json
                
                # Загружаем полные данные проекта
                try:
                    response = minio_client.get_object(MINIO_BUCKET, obj.object_name)
                    json_data = response.read().decode('utf-8')
                    project_data = json.loads(json_data)
                    
                    # Добавляем проект в список, используя данные из JSON
                    if 'project' in project_data:
                        project_info = project_data['project']
                    else:
                        # Если структура другая, используем корневой объект
                        project_info = project_data
                    
                    # # Убеждаемся, что есть все необходимые поля
                    # project_entry = {
                    #     'id': project_info.get('id', project_id),
                    #     'name': project_info.get('name', 'Без названия'),
                    #     'category': project_info.get('category', ''),
                    #     'type': project_info.get('type', 'classic'),
                    #     'deadline': project_info.get('deadline', ''),
                    #     'createdAt': project_info.get('createdAt', ''),
                    #     'owner': project_info.get('owner', '')
                    # }
                    projects.append(project_info)
                    app_logger.info(f"{(project_info)}")
                except Exception as e:
                    app_logger.warning(f"Не удалось загрузить данные проекта {project_id}: {e}")
                    # Добавляем хотя бы базовую информацию
                    # projects.append({
                    #     'id': project_id,
                    #     'name': f'Проект {project_id}',
                    #     'category': '',
                    #     'type': 'classic',
                    #     'deadline': '',
                    #     'createdAt': obj.last_modified.strftime('%Y-%m-%d'),
                    #     'owner': ''
                    # })
        
        app_logger.info(f"Найдено {len(projects)} проектов в MinIO")
        
        return jsonify({
            'success': True,
            'projects': projects,
            'count': len(projects)
        }), 200
    except S3Error as e:
        app_logger.error(f"Ошибка получения списка проектов: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/delete_project/<project_id>', methods=['DELETE'])
@handle_minio_errors
def delete_project(project_id):
    """
    Удаляет проект из MinIO по его ID.
    """
    app_logger.info(f"Запрос на удаление проекта {project_id} из MinIO")
    
    # Формируем имя объекта в MinIO
    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}.json"
    
    try:
        minio_client.remove_object(MINIO_BUCKET, object_name)
        app_logger.info(f"Проект {project_id} успешно удалён из MinIO")
        
        return jsonify({
            'success': True,
            'project_id': project_id,
            'message': f'Project deleted successfully'
        }), 200
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Проект {project_id} не найден в MinIO для удаления")
            return jsonify({'error': f'Project {project_id} not found'}), 404
        app_logger.error(f"Ошибка удаления проекта из MinIO: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ==================== Recent Files & Modal States Endpoints (MinIO Storage) ====================

@app.route('/api/recent_files', methods=['GET'])
@handle_minio_errors
def get_recent_files():
    """
    Получает список недавних файлов из MinIO.
    """
    app_logger.info("Запрос списка недавних файлов из MinIO")
    
    object_name = "ui_state/recent_files.json"
    
    try:
        response = minio_client.get_object(MINIO_BUCKET, object_name)
        json_str = response.read().decode('utf-8')
        response.close()
        response.release_conn()
        
        data = json.loads(json_str)
        app_logger.debug(f"Загружено {len(data.get('files', []))} недавних файлов")
        
        return jsonify({
            'success': True,
            'files': data.get('files', [])
        }), 200
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.debug("Список недавних файлов ещё не создан")
            return jsonify({'success': True, 'files': []}), 200
        app_logger.error(f"Ошибка загрузки недавних файлов: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/recent_files', methods=['POST'])
@handle_minio_errors
def save_recent_files():
    """
    Сохраняет список недавних файлов в MinIO.
    """
    app_logger.info("Сохранение списка недавних файлов в MinIO")
    
    data = request.get_json()
    if not data or 'files' not in data:
        return jsonify({'error': 'Missing "files" field'}), 400
    
    object_name = "ui_state/recent_files.json"
    
    try:
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        json_bytes = json_str.encode('utf-8')
        
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type='application/json'
        )
        app_logger.debug(f"Сохранено {len(data['files'])} недавних файлов")
        
        return jsonify({'success': True}), 200
    except Exception as e:
        app_logger.error(f"Ошибка сохранения недавних файлов: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/modal_states', methods=['GET'])
@handle_minio_errors
def get_modal_states():
    """
    Получает состояние модальных окон из MinIO.
    """
    app_logger.info("Запрос состояния модальных окон из MinIO")
    
    object_name = "ui_state/modal_states.json"
    
    try:
        response = minio_client.get_object(MINIO_BUCKET, object_name)
        json_str = response.read().decode('utf-8')
        response.close()
        response.release_conn()
        
        data = json.loads(json_str)
        app_logger.debug(f"Загружено состояний модальных окон: {len(data.get('states', {}))}")
        
        return jsonify({
            'success': True,
            'states': data.get('states', {})
        }), 200
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.debug("Состояние модальных окон ещё не создано")
            return jsonify({'success': True, 'states': {}}), 200
        app_logger.error(f"Ошибка загрузки состояния модальных окон: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/modal_states', methods=['POST'])
@handle_minio_errors
def save_modal_states():
    """
    Сохраняет состояние модальных окон в MinIO.
    """
    app_logger.info("Сохранение состояния модальных окон в MinIO")
    
    data = request.get_json()
    if not data or 'states' not in data:
        return jsonify({'error': 'Missing "states" field'}), 400
    
    object_name = "ui_state/modal_states.json"
    
    try:
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        json_bytes = json_str.encode('utf-8')
        
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name,
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type='application/json'
        )
        app_logger.debug(f"Сохранено состояний модальных окон: {len(data['states'])}")
        
        return jsonify({'success': True}), 200
    except Exception as e:
        app_logger.error(f"Ошибка сохранения состояния модальных окон: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':

    # Запускаем сервер
    print(f"Server starting...")
    print(f"Script directory: {script_dir}")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Open http://127.0.0.1:15404 in your browser")
    set_minio_client()
    app.run(debug=True, host='0.0.0.0', port=15404)