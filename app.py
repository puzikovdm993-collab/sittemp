import os
import sys
import copy
import numpy as np
from io import BytesIO
from datetime import datetime
from werkzeug.utils import secure_filename
from minio import Minio
from minio.error import S3Error
import base64
import json
import io
import logging
import uuid
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file, abort, send_from_directory,render_template, session, make_response,Response

import re


SAFE_PATH_PATTERN = re.compile(r'^[a-zA-Z0-9/_\.\-]+$')
# Регулярное выражение для валидации project_id
PROJECT_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')

# ------------------- Настройка логирования -------------------
def setup_logging(app):  # Теперь функция принимает app как аргумент

    # #Для продакшена (минимум информации)
    # app_logger_Level = logging.WARNING          # Логгер игнорирует DEBUG и INFO
    # console_handler_Level = logging.WARNING     # Только WARNING, ERROR, CRITICAL в консоль
    # file_handler_Level = logging.INFO           # В файл записываются INFO и выше
    # request_logger_Level = logging.INFO     # Логируем запросы 

    # Для разработки (максимум деталей)
    app_logger_Level = logging.INFO     # Логгер собирает все уровни
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

# Путь к папке frontend
# frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
# app = Flask(__name__, 
#             template_folder=frontend_dir, 
#             static_folder=frontend_dir)

# Установить время кэширования для статических файлов на 1 год (в секундах)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000 

app_logger = setup_logging(app)  # Передаем app в функцию
app_logger.info("Инициализировано Flask-приложение")






# Глобальные переменные для MinIO (будут загружены из .env при инициализации)

minio_client = None  # Глобальная переменная (изначально None)
MINIO_ENDPOINT = None
MINIO_ACCESS_KEY = None
MINIO_SECRET_KEY = None
MINIO_REGION = None
MINIO_SECURE = None
MINIO_BUCKET = 'mybucket'
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
    """
    global minio_client, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_REGION, MINIO_SECURE
    
    # Загружаем переменные окружения из .env (если он есть)
    load_dotenv()

    # Получаем параметры из окружения (с дефолтами)
    endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    bucket = os.getenv("MINIO_BUCKET", "mybucket")
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
    
    # Создаём новый клиент
    minio_client = Minio(
        endpoint=endpoint,
        access_key=access_key,
        secret_key=secret_key,
        region=region,
        secure=secure
    )

    # print(f"endpoint {endpoint}")
    # print(f"access_key {access_key}")
    # print(f"secret_key {secret_key}")
    # print(f"bucket {bucket}")
    # print(f"region {region}")
    # print(f"secure {secure}")

    
    # Проверяем подключение
    try:
        minio_client.list_buckets()
        print("✅ MinIO клиент успешно инициализирован из .env!")
    except Exception as e:
        raise ConnectionError(f"❌ Ошибка подключения к MinIO: {e}") from e
    
    return minio_client

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








@app.route('/')
def projects():
    # if not os.path.exists('wtis_projects.html'):
    #     app_logger.error("Файл wtis_projects.html не найден")
    #     abort(404)
    # return send_from_directory('.', 'wtis_projects.html')
    response = make_response(send_from_directory(app.static_folder, 'wtis_projects.html'))
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

@app.route('/projects')
def projects1():
    if not os.path.exists('wtis_projects.html'):
        app_logger.error("Файл wtis_projects.html не найден")
        abort(404)
    return send_from_directory('.', 'wtis_projects.html')
    
    # response = make_response(send_from_directory(app.static_folder, 'wtis_projects.html'))
    # response.headers['Cache-Control'] = 'public, max-age=3600'
    # return response

@app.route('/workspace')
def index():
    response = make_response(send_from_directory(app.static_folder, 'wtis_workspace.html'))
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response



@app.route('/script-tag')
def get_script_tag():
    """Возвращает тег script, как в запросе"""
    # Формируем ответ с MIME-типом text/html, так как это HTML-тег
    response = make_response('<script src="src/tabs/tabs.js"></script>')
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response
@app.route('/workflow')
def workflow():
    if not os.path.exists('wtis_workflow.html'):
        app_logger.error("Файл wtis_workflow.html не найден")
        abort(404)
    return send_from_directory('.', 'wtis_workflow.html')

@app.route('/viewIcons')
def viewIcons():
    # Отдаём incon из корня проекта
    if not os.path.exists('icons-preview.html'):
        abort(404)
    return send_from_directory('.', 'icons-preview.html')

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
        return jsonify({
            "login": "default",
            "original_login": "default",
            "authenticated": True
        }), 200

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
    default_user_name = "default"
    user_login = login_translations.get(aut_login, default_user_name)
    return jsonify({
        "login": user_login,
        "original_login": aut_login,
        "authenticated": True
    }), 200

@app.route('/new_int')
def viewNewInterface():
    # Отдаём incon из корня проекта
    if not os.path.exists('test2_0.html'):
        abort(404)
    return send_from_directory('.', 'test2_0.html')





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


@app.route('/health', methods=['GET'])
def health_check():
    """
    Проверка здоровья сервера и доступности зависимостей (MinIO).
    """
    health_status = {
        "status": "healthy",
        "minio": "ok",
        "timestamp": datetime.now().isoformat()
    }
    
    minio_status = "ok"
    
    # Проверка подключения к MinIO
    if minio_client is not None:
        try:
            # Легковесная проверка: попытка получить список бакетов или проверить соединение
            # list_buckets() обычно быстрая, если нет больших объемов данных
            minio_client.list_buckets()
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["minio"] = "error"
            health_status["error"] = str(e)
            minio_status = "error"
            app_logger.error(f"Health check failed: MinIO connection error: {e}")

    if health_status["status"] == "unhealthy":
        # Возвращаем 503, если зависимости недоступны
        return jsonify(health_status), 503

    app_logger.info("Проверка состояния сервера пройдена успешно")
    return jsonify(health_status), 200





# ==================== Project Management Endpoints ====================

# ===================== Проекты (/api/v1/projects) =====================
@app.route('/api/v1/projects', methods=['GET'])
@handle_minio_errors
def list_projects_api():
    """
    Возвращает список всех проектов из MinIO.
    Ожидаемая структура: {MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.project
    """
    app_logger.info("Запрос списка проектов из MinIO")
    
    projects = []
    
    try:
        # Получаем список всех объектов с префиксом проектов
        # recursive=True необходим, так как файлы находятся в подпапках
        objects = minio_client.list_objects(MINIO_BUCKET, prefix=MINIO_PROJECTS_PREFIX, recursive=True)
        
        for obj in objects:
            # Пропускаем "папки" (объекты, заканчивающиеся на /)
            
            if obj.object_name.endswith('/'):
                continue
            
            # Проверяем, что это JSON-файл
            # if not obj.object_name.endswith('.project'):
            #     continue
            
            # Извлекаем project_id из пути
            # Структура: prefix/{project_id}/{project_id}.json
            # split('/') даст: ['', 'prefix', 'project_id', 'project_id.json']
            # или если prefix пустой или содержит слеши, нужно быть осторожным.
            # Безопаснее использовать rsplit для получения последних частей.
            
            parts = obj.object_name.split('/')  
            
            # Предполагаем, что prefix не содержит слеши, иначе логика сложнее.
            # Если prefix есть, то:
            # parts[0] - пустой (если путь начинается с /) или часть prefix
            # parts[1] - проект_id (если prefix без слешей и один уровень глубины)
            
            # Более надежный способ для структуры {prefix}{id}/{id}.json:
            # Убираем префикс из имени файла
            if obj.object_name.startswith(MINIO_PROJECTS_PREFIX):
                relative_path = obj.object_name[len(MINIO_PROJECTS_PREFIX):]
            else:
                continue # Не относится к нашим проектам
            
            # relative_path теперь: "{project_id}/{project_id}.json"
            relative_parts = relative_path.split('/')
             
            if len(relative_parts) < 2:
                app_logger.warning(f"Некорректный путь проекта: {obj.object_name}")
                continue
                
            
            project_id = relative_parts[0]
            
            # Дополнительная проверка: имя файла должно совпадать с id (опционально, но надежно)
            expected_filename = f"{project_id}.project"
            actual_filename = relative_parts[1]
            
            if actual_filename != expected_filename:
                app_logger.warning(f"Имя файла не совпадает с ID в пути: {obj.object_name}")
                # Можно либо пропустить, либо использовать как есть, если логика допускает расхождения
                continue

            # Загружаем данные
            try:
               
                response = minio_client.get_object(MINIO_BUCKET, obj.object_name)
                json_data = response.read().decode('utf-8')
                project_data = json.loads(json_data)
                
                # Извлекаем данные проекта
                   
                project_info = {}
                project_info["id"]=project_data.get("project").get("id")
                project_info["lastUpdate"]=project_data.get("project").get("updatedAt")
                project_info["type"]=project_data.get("project").get("type")
                project_info["name"]=project_data.get("project").get("name")
                project_info["owner"]=project_data.get("project").get("owner")
                project_info["settings"]=project_data.get("project").get("settings")
                app_logger.info(f"project_info =  {project_info}")  


                projects.append(project_info)
                
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                app_logger.error(f"Ошибка парсинга JSON для {project_id}: {e}")
            except Exception as e:
                app_logger.warning(f"Не удалось загрузить данные проекта {project_id}: {e}")
                
    except S3Error as e:
        app_logger.error(f"Ошибка получения списка объектов из MinIO: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500
    
    app_logger.info(f"Найдено {len(projects)} проектов в MinIO")
    
    return jsonify({
        'success': True,
        'projects': projects,
        'count': len(projects)
    }), 200

@app.route('/api/v1/projects', methods=['POST'])
@handle_minio_errors
def save_project():
    """
    Сохраняет проект в MinIO в формате JSON.
    Ожидает JSON с структурой проекта.
    """
    app_logger.info("Запрос на сохранение проекта в MinIO")
    
    # Получаем данные проекта из запроса
    data = request.get_json()
    if not data:
        app_logger.error(f"error: No JSON data provided  400")
        return jsonify({'error': 'No JSON data provided'}), 400

    # Проверяем наличие обязательных полей
    if 'project' not in data:
        app_logger.error(f"error: Missing 'project' field  400 ")
        return jsonify({'error': 'Missing "project" field'}), 400
    

    project_id = data['project'].get('id')
    if not project_id:
        app_logger.error(f"error': 'Missing project id,  400")
        return jsonify({'error': 'Missing project id'}), 400
    
    # Формируем имя объекта в MinIO
    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    # print(object_name)

    # Преобразуем данные в JSON
    try:
        json_str = json.dumps(data, ensure_ascii=False, indent=2)
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
            'message': f'Project saved successfully'
        }), 201
    except S3Error as e:
        app_logger.error(f"Ошибка сохранения проекта в MinIO: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/projects/<project_id>', methods=['GET'])
@handle_minio_errors
def get_project_metadata_with_matrices(project_id):
    """
    Возвращает метаданные проекта с загруженными матрицами (включая history).
    """
    
    
    # 1. Валидация project_id
    if not PROJECT_ID_PATTERN.match(project_id):
        app_logger.warning(f"Некорректный format project_id: {project_id}")
        return jsonify({'error': 'Invalid project ID format'}), 400

    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    app_logger.info(f"Запрос метаданных с матрицами для проекта {project_id}")

    response = None
    try:
        # Получаем JSON метаданных
        response = minio_client.get_object(MINIO_BUCKET, object_name)
        json_str = response.read().decode('utf-8')
        full_data = json.loads(json_str)

        app_logger.info(f"Метаданные с матрицами для проекта {project_id} успешно сформированы")
        return jsonify(full_data), 200

    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Проект {project_id} не найден в MinIO")
            return jsonify({'error': f'Project {project_id} not found'}), 404
        elif e.code == 'AccessDenied':
            app_logger.warning(f"Отказано в доступе к проекту {project_id}")
            return jsonify({'error': 'Access denied'}), 403
        else:
            app_logger.error(f"Ошибка MinIO: {e}", exc_info=True)
            return jsonify({'error': 'Internal server error'}), 500
    except json.JSONDecodeError as e:
        app_logger.error(f"Ошибка парсинга JSON для {project_id}: {e}", exc_info=True)
        return jsonify({'error': 'Invalid JSON format'}), 500
    except Exception as e:
        app_logger.error(f"Неожиданная ошибка при обработке {project_id}: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        # 6. Гарантированное закрытие ресурса
        if response is not None:
            response.close()
            response.release_conn()

@app.route('/api/v1/projects/<project_id>', methods=['DELETE'])
@handle_minio_errors
def delete_project(project_id):
    """
    Удаляет проект из MinIO по его ID.
    """
    app_logger.info(f"Запрос на удаление проекта {project_id} из MinIO")
    
    # Формируем имя объекта в MinIO
    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    
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
            app_logger.warning(f"Проект4 {project_id} не найден в MinIO для удаления")
            return jsonify({'error': f'Project {project_id} not found'}), 404
        app_logger.error(f"Ошибка удаления проекта из MinIO: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500



# ============= Файлы (/api/v1/projects/{projectId}/files) =============
@app.route('/api/v1/projects/<project_id>/files', methods=['GET'])
@handle_minio_errors
def get_project_files(project_id):
    """
    Получает список файлов проекта из JSON-файла, хранящегося в MinIO.
    """
    app_logger.info(f"Запрос на получение списка файлов для проекта {project_id}")

    # 1. Формируем имя объекта в MinIO
    object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"

    try:
        # 2. Загружаем объект из MinIO
        response = minio_client.get_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name
        )
        
        # 3. Считываем и декодируем данные
        try:
            data_bytes = response.read()
            response.close()
            response.release_conn()
            
            project_data_str = data_bytes.decode('utf-8')
            project_data = json.loads(project_data_str)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            app_logger.error(f"Ошибка парсинга JSON для проекта {project_id}: {e}")
            return jsonify({'error': 'Invalid JSON format in project file'}), 400
        finally:
            if response:
                response.close()
                response.release_conn()

    except S3Error as e:
        # S3Error с кодом NoSuchKey или 404 означает, что файл проекта не существует
        if e.code == 'NoSuchKey' or e.status_code == 404:
            app_logger.warning(f"Файл проекта не найден: {object_name}")
            return jsonify({'error': 'Project not found'}), 404
        else:
            app_logger.error(f"Ошибка MinIO при получении файла проекта: {e}")
            return jsonify({'error': 'Failed to load project file'}), 500
    except Exception as e:
        app_logger.error(f"Неожиданная ошибка при получении файла проекта: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

    # 4. Извлекаем список файлов
    files = project_data.get('project').get('files')
    app_logger.info(files)
    if files is None:
        app_logger.warning(f"В файле проекта {project_id} отсутствует поле 'files'")
        return jsonify({'error': 'Project file structure is invalid: missing "files"'}), 400

    # Возвращаем список файлов
    return jsonify({
        'success': True,
        'project_id': project_id,
        'files': files
    }), 200

@app.route('/api/v1/projects/<project_id>/files/<file_id>', methods=['GET'])
def load_file_matrix(project_id, file_id):
    """
    Загружает бинарную матрицу для конкретного файла проекта.
    Путь: /api/projects/{project_id}/files/{file_id}
    """
    app_logger.info(f"Запрос на загрузку матрицы файла {file_id} проекта {project_id}")

    # 1. Загружаем метаданные проекта из MinIO
    project_object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    
    try:
        response = minio_client.get_object(
            bucket_name=MINIO_BUCKET,
            object_name=project_object_name
        )
        project_json_str = response.read().decode('utf-8')
        response.close()
        response.release_conn()
        
        project_data = json.loads(project_json_str)
        
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Проект не найден: {project_object_name}")
            return jsonify({'error': 'Project not found'}), 404
        app_logger.error(f"Ошибка MinIO при загрузке проекта: {e}")
        return jsonify({'error': 'Failed to load project metadata'}), 500
    except Exception as e:
        app_logger.error(f"Ошибка парсинга проекта: {e}", exc_info=True)
        return jsonify({'error': 'Failed to parse project data'}), 500

    # 2. Находим нужный файл в проекте
    files = project_data.get('files', [])
    target_file = None
    
    for f in files:
        if f.get('id') == file_id:
            target_file = f
            break

    if not target_file:
        app_logger.warning(f"Файл {file_id} не найден в проекте {project_id}")
        return jsonify({'error': 'File not found in project'}), 404

    # 3. Определяем путь к бинарному файлу матрицы
    object_name = None
    
    # Приоритет 1: matrix_ref (если сохранен при записи)
    matrix_ref = target_file.get('matrix_ref')
    if matrix_ref:
        object_name = matrix_ref
    else:
        # Приоритет 2: filename (формирование пути по стандарту)
        filename = target_file.get('filename')
        if not filename:
            return jsonify({'error': 'File has no matrix data or reference'}), 404
        object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{filename}_matrix.npy"

    # 4. Загружаем бинарные данные из MinIO
    try:
        binary_response = minio_client.get_object(
            bucket_name=MINIO_BUCKET,
            object_name=object_name
        )
        binary_data = binary_response.read()
        binary_response.close()
        binary_response.release_conn()
        
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Бинарный файл не найден: {object_name}")
            return jsonify({'error': 'Matrix file not found in MinIO'}), 404
        app_logger.error(f"Ошибка MinIO при загрузке матрицы: {e}")
        return jsonify({'error': 'Failed to load matrix data'}), 500
    except Exception as e:
        app_logger.error(f"Ошибка сети: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retrieve matrix data'}), 500

    # 5. Десериализация NumPy
    try:
        buffer = io.BytesIO(binary_data)
        matrix_array = np.load(buffer)
        buffer.close()
        
        # Конвертация в JSON-совместимый список
        matrix_list = matrix_array.tolist()
        
        return jsonify({
            'success': True,
            'project_id': project_id,
            'file_id': file_id,
            'filename': target_file.get('filename'),
            'matrix': matrix_list,
            'shape': list(matrix_array.shape),
            'dtype': str(matrix_array.dtype)
        }), 200
        
    except Exception as e:
        app_logger.error(f"Ошибка десериализации: {e}", exc_info=True)
        return jsonify({'error': 'Failed to deserialize matrix data'}), 500

@app.route('/api/v1/projects/<project_id>/files/<file_id>', methods=['POST'])
@handle_minio_errors
def create_or_update_project_file(project_id, file_id):
    """
    Сохраняет матрицу файла в MinIO и обновляет метаданные файла внутри project.files
    в общем файле проекта {project_id}.json.
    """
    app_logger.info(f"Запрос на сохранение файла '{file_id}' в проект '{project_id}'")

    project_key = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    app_logger.debug(f"project_key = {project_key}")

    # 1. Проверка бакета
    try:
        if not minio_client.bucket_exists(MINIO_BUCKET):
            return jsonify({'error': f'Bucket "{MINIO_BUCKET}" does not exist'}), 404
        app_logger.debug(f"Бакет '{MINIO_BUCKET}' успешно проверен и существует")
    except S3Error as e:
        app_logger.error(f"Ошибка проверки бакета: {e}", exc_info=True)
        raise


    # Получаем и парсим метаданные
    if 'metadata' not in request.form:
        app_logger.errors(f"Отсутствует поле metadata")
        return jsonify({'error': 'Отсутствует поле "metadata"'}), 400
    metadata_str = request.form['metadata']

    try:
        metadata = json.loads(metadata_str)
        app_logger.debug(f"Успешно распаршен JSON: {metadata}")
        app_logger.debug(f"metadata = {json.dumps(metadata, ensure_ascii=False, indent=4)}")
    except json.JSONDecodeError as e:
        app_logger.errors(f"Некорректный формат JSON в metadata: {e}")
        return jsonify({'error': 'Некорректный формат JSON в поле "metadata"'}), 400

    # Извлекаем параметры
    action = metadata.get('history')
    hist_idx = metadata.get('historyIndex')

    app_logger.debug(f"action = {action}")
    app_logger.debug(f"hist_idx = {hist_idx}")

    # Путь к файлу шага истории
    hist_key = f"{MINIO_PROJECTS_PREFIX}{project_id}/{file_id}_step_{hist_idx}.bin"

    if 'matrix' not in request.files:
        return jsonify({'error': 'Отсутствует файл "matrix"'}), 400
    matrix_file = request.files['matrix']

    file_data = matrix_file.read()
    file_size = len(file_data)
    try:
        # Загрузка в MinIO
        minio_client.put_object(
            MINIO_BUCKET,
            hist_key,
            data=BytesIO(file_data),
            length=file_size,
            content_type='application/octet-stream'
        )
        app_logger.debug(f"Успешная загрузка матрицы в минио ")
    except S3Error as e:
        app_logger.error(f"Ошибка MinIO при сохранении: {e}", exc_info=True)
        return jsonify({'error': f"Ошибка сохранения в хранилище: {e}"}), 500


    # Загружаем данные проекта из MinIO
    try:
        response = minio_client.get_object(MINIO_BUCKET, project_key)
        json_data = response.read().decode('utf-8')
        project_data1 = json.loads(json_data)
        project_data = project_data1.get('project')
        app_logger.debug(f"Данные проекта {project_id} успешко загружены.")
    except S3Error as e:
        if e.code == 'NoSuchKey':
            app_logger.warning(f"Проект5 {project_id} не найден в MinIO")
            return jsonify({'success': False, 'error': f'Проект {project_id} не найден'}), 404
        raise
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        app_logger.error(f"Ошибка парсинга JSON проекта {project_id}: {e}")
        return jsonify({'success': False, 'error': 'Ошибка формата данных проекта'}), 500
    app_logger.debug(f"project_data = {json.dumps(project_data, ensure_ascii=False, indent=4)}")


    files = project_data.get("files", [])
    app_logger.debug(f"files = {json.dumps(files, ensure_ascii=False, indent=4)}")


    metadata["matrix"] = hist_key
    # metadata["history"]["matrix"] = hist_key

    # Проверка безопасности индекса
    if 0 <= metadata["historyIndex"] < len(metadata["history"]):
        metadata["history"][metadata["historyIndex"]]["matrix"] = hist_key
        app_logger.debug(f"Обновлено: {metadata['history'][metadata['historyIndex']]['matrix']}")
    else:
        app_logger.debug("Ошибка: historyIndex выходит за границы списка history")


    files.append(metadata)
    app_logger.debug(f"files = {json.dumps(files, ensure_ascii=False, indent=4)}")
    
    try:
        project_data1['project'] = project_data
        app_logger.debug(f"project_data1 = {json.dumps(project_data1, ensure_ascii=False, indent=4)}")



    
        json_str = json.dumps(project_data1, ensure_ascii=False, indent=4)
        json_bytes = json_str.encode('utf-8')
                    
        ensure_bucket(minio_client, MINIO_BUCKET)
        
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=project_key,
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type='application/json'
        )
        
        app_logger.info(f"Проект {project_id} успешно обновлен и сохранен.")
    
        return jsonify({
            "status": "success",
            "message": "files updated"
        }), 201
    except S3Error as e:
        app_logger.error(f"Ошибка MinIO при сохранении: {e}", exc_info=True)
        return jsonify({'error': f"Ошибка сохранения в хранилище: {e}"}), 500
    
    except Exception as e:
        app_logger.error(f"Неожиданная ошибка: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/projects/<project_id>/files/<file_id>', methods=['DELETE'])
@handle_minio_errors
def delete_project_file(project_id, file_id):
    """
    Удаляет файл из проекта.
    - Удаляет объект матрицы из MinIO.
    - Удаляет запись файла из JSON проекта.
    """
    app_logger.info(f"Запрос на удаление файла {file_id} проекта {project_id}")

    # 1. Получаем текущий проект из MinIO
    project_object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    try:
        response = minio_client.get_object(
            bucket_name=MINIO_BUCKET, 
            object_name=project_object_name
        )
        project_data = json.loads(response.read().decode('utf-8'))
        response.close()
        response.release_conn()
    except Exception as e:
        app_logger.error(f"Ошибка чтения проекта {project_id}: {e}")
        return jsonify({'error': 'Project not found or could not be read'}), 404

    files = project_data.get('files', [])
    target_file = None
    target_index = -1

    # 2. Ищем файл в списке
    for idx, f in enumerate(files):
        if str(f.get('id')) == str(file_id):
            target_file = f
            target_index = idx
            break
    
    if target_file is None:
        return jsonify({'error': f'File with ID {file_id} not found in project {project_id}'}), 404

    # 3. Удаляем бинарные данные матрицы из MinIO, если они есть
    matrix_ref = target_file.get('matrix_ref')
    if matrix_ref:
        try:
            minio_client.remove_object(
                bucket_name=MINIO_BUCKET,
                object_name=matrix_ref
            )
            app_logger.info(f"Матрица файла {file_id} удалена из MinIO: {matrix_ref}")
        except Exception as e:
            # Логируем ошибку, но продолжаем удаление файла, чтобы не блокировать пользователя
            # Если удаление файла важно для целостности, можно вернуть 500
            app_logger.warning(f"Не удалось удалить объект матрицы {matrix_ref}: {e}")

    # 4. Удаляем файл из списка и сохраняем проект
    files.pop(target_index)
    project_data['files'] = files
    
    try:
        json_str = json.dumps(project_data, ensure_ascii=False, indent=2)
        json_bytes = json_str.encode('utf-8')
        
        ensure_bucket(minio_client, MINIO_BUCKET)
        
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=project_object_name,
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type='application/json'
        )
        
        app_logger.info(f"Файл {file_id} успешно удален из проекта {project_id}.")
        
        return jsonify({
            'success': True,
            'project_id': project_id,
            'file_id': file_id,
            'message': 'File deleted successfully.'
        }), 200
        
    except Exception as e:
        app_logger.error(f"Ошибка сохранения JSON проекта {project_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to save project JSON after deletion'}), 500



# ============= История (/api/v1/projects/{projectId}/files/{fileId}/history) =============
@app.route('/api/v1/projects/<project_id>/files/<file_id>/history', methods=['POST'])
@handle_minio_errors
def replace_file_history(project_id, file_id):
    """
    Полностью заменяет историю для конкретного файла проекта.
    
    URL: /api/v1/projects/{project_id}/files/{file_id}/history
    Body: { "history": [...] }
    """
    app_logger.info(f"Запрос на полную замену истории: проект = {project_id}, файл = {file_id}")
    
    try:
        # 1. Формируем путь к файлу проекта в MinIO
        # Структура: prefix/{project_id}/{project_id}.json
        project_key = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
        
        # 2. Загружаем данные проекта из MinIO
        try:
            response = minio_client.get_object(MINIO_BUCKET, project_key)
            json_data = response.read().decode('utf-8')
            project_data = json.loads(json_data)
            app_logger.debug(f"Данные проекта {project_id} успешко загружены.")
        except S3Error as e:
            if e.code == 'NoSuchKey':
                app_logger.warning(f"Проект 6 {project_id} не найден в MinIO")
                return jsonify({'success': False, 'error': f'Проект {project_id} не найден'}), 404
            raise
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            app_logger.error(f"Ошибка парсинга JSON проекта {project_id}: {e}")
            return jsonify({'success': False, 'error': 'Ошибка формата данных проекта'}), 500



        # 3. Извлекаем объект проекта (учитываем вложенность 'project', как в GET)
        if isinstance(project_data, dict) and 'project' in project_data:
            project_info = project_data['project']
        else:
            project_info = project_data

        app_logger.debug(f"Извлечение данных о проекте {project_id}.")

        # 4. Находим целевой файл по file_id
        files = project_info.get('files', [])
        target_file = None
        
        for f in files:
            if f.get('id') == file_id:
                target_file = f
                break
    
        if not target_file:
            app_logger.warning(f"Файл {file_id} не найден в проекте {project_id}")
            return jsonify({'success': False, 'error': f'Файл с ID {file_id} не найден'}), 404

        app_logger.debug(f"Файл с ID {file_id} найден.")

        # 5. Парсим тело запроса
        body1 = request.get_json()
        body = body1.get('file')
        if not body:
            return jsonify({'success': False, 'error': 'Тело запроса отсутствует или не является JSON'}), 400

        # 1.2. История матриц
        history = body.get('history', [])
        for hist_idx, hist_item in enumerate(history):
            hist_matrix = hist_item.get('matrix')
            if hist_matrix is not None:
                try:
                    if not isinstance(hist_matrix, np.ndarray):
                        hist_arr = np.array(hist_matrix)
                    else:
                        hist_arr = hist_matrix

                    hist_byte_io = io.BytesIO()
                    np.save(hist_byte_io, hist_arr)
                    hist_npy_bytes = hist_byte_io.getvalue()

                    timestamp = hist_item.get('timestamp', f"hist_{hist_idx}")
                    # app_logger.debug(f"hist_idx {hist_idx} ")
                    hist_key = f"projects/{project_id}/{file_id}_step_{hist_idx}.npy"
                    
                    minio_client.put_object(
                        MINIO_BUCKET,
                        hist_key,
                        io.BytesIO(hist_npy_bytes),
                        length=len(hist_npy_bytes),
                        content_type='application/octet-stream'
                    )
                    hist_item['matrix'] = hist_key

                except Exception as e:
                    app_logger.error(f"Ошибка сохранения истории: {e}", exc_info=True)
                    raise

        new_history = body.get('history')

        # Валидация: поле history должно быть массивом
        if new_history is None or not isinstance(new_history, list):
            return jsonify({'success': False, 'error': 'Поле "history" должно быть массивом'}), 400

        # 6. Полная замена истории
        target_file['history'] = new_history
        
        # Обновляем индекс истории на последний элемент
        # Если история пуста, ставим -1 (или 0, в зависимости от требований UI)
        target_file['historyIndex'] = len(new_history) - 1 if new_history else -1

        # 7. Сохраняем обратно в MinIO
        new_json_data = json.dumps(project_data, ensure_ascii=False, indent=2)
        data_bytes = new_json_data.encode('utf-8')
        
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=project_key, 
            data=io.BytesIO(data_bytes),
            length=len(data_bytes),
            content_type='application/json'
        )
        
        app_logger.info(f"История полностью заменена для файла {file_id} в проекте {project_id}. Записей: {len(new_history)}")
        
        return jsonify({
            'success': True,
            'message': 'История успешно обновлена',
            'historyCount': len(new_history)
        }), 201

    except Exception as e:
        app_logger.error(f"Неожиданная ошибка при замене истории: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/v1/projects/<project_id>/files/<file_id>/history', methods=['PATCH'])
@handle_minio_errors
def replace_file_historyfdfdf(project_id, file_id):
    app_logger.info(f"Запрос на добавление в истории: проект = {project_id}, файл = {file_id}")
    # Формируем путь к файлу мета-данными проекта в MinIO
    # Структура: prefix/{project_id}/{project_id}.json
    project_key = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.json"
    app_logger.debug(f"project_key = {project_key}")

    try:

        # Получаем и парсим метаданные
        if 'metadata' not in request.form:
            app_logger.errors(f"error Missing metadata")
            return jsonify({'error': 'Отсутствует поле "metadata"'}), 400
        metadata_str = request.form['metadata']
        metadata = json.loads(metadata_str)

        # Извлекаем параметры
        action = metadata.get('history')
        hist_idx = metadata.get('historyIndex')

        app_logger.debug(f"action = {action}")
        app_logger.debug(f"hist_idx = {hist_idx}")




        # Путь к файлу шага истории
        hist_key = f"{MINIO_PROJECTS_PREFIX}{project_id}/{file_id}_step_{hist_idx}.bin"
        # app_logger.debug(f"hist_key = {hist_key}")

        if 'matrix' not in request.files:
            return jsonify({'error': 'Отсутствует файл "matrix"'}), 400
        matrix_file = request.files['matrix']
        # app_logger.info(matrix_file)

        file_data = matrix_file.read()
        file_size = len(file_data)
        try:
            # Загрузка в MinIO
            minio_client.put_object(
                MINIO_BUCKET,
                hist_key,
                data=BytesIO(file_data),
                length=file_size,
                content_type='application/octet-stream'
            )
        except S3Error as e:
            app_logger.error(f"Ошибка MinIO при сохранении: {e}", exc_info=True)
            return jsonify({'error': f"Ошибка сохранения в хранилище: {e}"}), 500







        # Загружаем данные проекта из MinIO
        try:
            response = minio_client.get_object(MINIO_BUCKET, project_key)
            json_data = response.read().decode('utf-8')
            project_data1 = json.loads(json_data)
            project_data = project_data1.get('project')
            app_logger.debug(f"Данные проекта {project_id} успешко загружены.")
        except S3Error as e:
            if e.code == 'NoSuchKey':
                app_logger.warning(f"Проект7 {project_id} не найден в MinIO")
                return jsonify({'success': False, 'error': f'Проект {project_id} не найден'}), 404
            raise
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            app_logger.error(f"Ошибка парсинга JSON проекта {project_id}: {e}")
            return jsonify({'success': False, 'error': 'Ошибка формата данных проекта'}), 500
        app_logger.debug(f"project_data = {json.dumps(project_data, ensure_ascii=False, indent=2)}")




        files = project_data.get("files", [])
        app_logger.debug(f"files = {json.dumps(files, ensure_ascii=False, indent=2)}")

        # Поиск элемента file_id
        file_obj = next((f for f in files if f["id"] == file_id), None)
        app_logger.debug(f"file_obj = {json.dumps(file_obj, ensure_ascii=False, indent=2)}")


        # Извлечение истории 
        file_obj_his = file_obj.get('history')
        slice_0_hist_idx = file_obj_his[0:hist_idx]
        action["matrix"] = hist_key
        slice_0_hist_idx.append(action)

        app_logger.debug(f"slice_0_hist_idx: {slice_0_hist_idx}")

        
       
        file_obj['history'] = slice_0_hist_idx

        # app_logger.debug(f"{json.dumps(file_obj['history'], ensure_ascii=False, indent=2)}")

        for file_ob in files:
            if file_ob['id'] == file_id:
                file_ob = file_obj
                break  # выходим после первой замены (если нужно менять только один)

       
        
        project_data1['project'] = project_data
        app_logger.debug(f"project_data1 = {json.dumps(project_data1, ensure_ascii=False, indent=2)}")

        # 4. Сохраняем обновленный проект в MinIO (JSON)
        try:
            json_str = json.dumps(project_data1, ensure_ascii=False, indent=2)
            json_bytes = json_str.encode('utf-8')
                       
            ensure_bucket(minio_client, MINIO_BUCKET)
            
            minio_client.put_object(
                bucket_name=MINIO_BUCKET,
                object_name=project_key,
                data=io.BytesIO(json_bytes),
                length=len(json_bytes),
                content_type='application/json'
            )
            
            app_logger.info(f"Проект {project_id} успешно обновлен и сохранен.")
                       
        except Exception as e:
            app_logger.error(f"Ошибка сохранения JSON проекта: {e}", exc_info=True)
            return jsonify({'error': 'Failed to save project JSON'}), 500

        return jsonify({
            "status": "success",
            "message": "History updated"
        }), 200
    except Exception as e:
        # Логируйте ошибку в реальном приложении
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500






@app.route('/api/v2/projects/', methods=['GET'])
def download_file_from_minio123():
    """
    Загружает файл из MinIO по full_path и отдает клиенту.
    
    :param full_path: Путь к файлу в бакете (например, '123/matrix.bin')
    """

    full_path = request.args.get('fullPath')
    app_logger.debug(f"full_path: {full_path}")
    # 1. Проверка существования объекта
    try:
        stat = minio_client.stat_object(MINIO_BUCKET, full_path)
    except S3Error as e:
        if e.code == 'NoSuchKey':
            return jsonify({'error': 'Файл не найден'}), 404
        else:
            app.logger.error(f'Ошибка MinIO: {str(e)}')
            return jsonify({'error': 'Ошибка доступа к файлу'}), 500

    # 2. Извлечение данных
    # Вариант А: Для небольших файлов (до ~100-200 МБ)
    # Можно прочитать напрямую в память
    try:
        file_data = minio_client.get_object(MINIO_BUCKET, full_path).read()
    except S3Error as e:
        app.logger.error(f'Ошибка чтения из MinIO: {str(e)}')
        return jsonify({'error': 'Ошибка чтения файла'}), 500

    # 3. Определение имени файла для отправки клиенту
    # Извлекаем финальную часть пути или используем метаданные, если они хранились
    # Здесь просто берем последнее слово из пути
    filename = full_path.split('/')[-1]

    # 4. Отправка файла клиенту
    # send_file автоматически устанавливает правильные заголовки

    response = Response(
        file_data,
        mimetype='application/octet-stream',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )
    # app_logger.debug(f"file_data: {file_data}")
    return response









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






















@app.route('/api/data/received', methods=['GET'])
def get_received_data():
    """Отдает данные, которые были отправлены клиентом."""
    if not os.path.exists(RECEIVED_DATA_FILE):
        return jsonify({"error": "Нет принятых данных. Сначала отправьте их."}), 404

    return send_file(
        RECEIVED_DATA_FILE,
        mimetype='application/octet-stream',
        as_attachment=True,
        download_name='received_project.bin'
    )
# Конфигурация
UPLOAD_FOLDER = './uploadsadasdasd'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)




@app.route('/api/data/upload/<project_id>', methods=['POST'])
@handle_minio_errors
def upload_data(project_id):
    """Принимает бинарные данные и сохраняет их в файл."""
    project_object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.project"
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Тело запроса пусто"}), 400

        json_str = json.dumps(data, ensure_ascii=False, indent=2)
        json_bytes = json_str.encode('utf-8')
        
        minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=project_object_name, 
            data=io.BytesIO(json_bytes),
            length=len(json_bytes),
            content_type='application/json'
        )

        return jsonify({
            "status": "success",
            "message": "Данные приняты и сохранены.",
            "size_bytes": len(json_bytes)
        }), 201

    except Exception as e:
        print(f"Ошибка при сохранении: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data/upload/<project_id>', methods=['GET'])
@handle_minio_errors
def get_data(project_id):
    """Возвращает сохранённые данные проекта."""
    project_object_name = f"{MINIO_PROJECTS_PREFIX}{project_id}/{project_id}.project"
    
    try:
        # Получаем объект из MinIO
        response = minio_client.get_object(
            bucket_name=MINIO_BUCKET,
            object_name=project_object_name
        )
        # Читаем данные в память
        raw_data = response.read()

        response.close()
        response.release_conn()
        
        if not raw_data:
            return jsonify({"error": "Файл пуст или не найден"}), 404
            
        try:
            data_json = raw_data.decode('utf-8')
            full_data =json.loads(data_json)
            return jsonify({
                "status": "success",
                "project": full_data,
            }), 200
        except UnicodeDecodeError:
            # Если данные не UTF-8, возвращаем как бинарный файл
            return send_file(io.BytesIO(raw_data), mimetype='application/octet-stream')

    except Exception as e:
        print(f"Ошибка при получении данных: {e}")
        # Проверка на отсутствие объекта в MinIO
        if hasattr(e, 'code') and e.code == 404:
            return jsonify({"error": "Проект не найден"}), 404
        return jsonify({"error": str(e)}), 500

# ==================== Админ-панель: Дашборд анализа ====================

# Список логинов администраторов (можно дополнить/заменить на запрос к БД)
ADMIN_LOGINS = {"ganeevam", "galinovivik", "pavloviv", "PavlovIV"}


def is_admin_request():
    """Проверяет по заголовку Authorization (Basic), является ли пользователь администратором."""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return False
    try:
        auth_data = auth_header.split()[1]
        decoded_auth = base64.b64decode(auth_data).decode('utf-8')
        aut_login = decoded_auth.split(":")[0]
        return aut_login in ADMIN_LOGINS
    except (IndexError, UnicodeDecodeError, base64.binascii.Error):
        return False


def require_admin(f):
    """Декоратор: доступ только для администраторов."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_admin_request():
            app_logger.warning(f"Попытка доступа к админ-ресурсу {request.path} без прав администратора")
            return jsonify({'error': 'Доступ запрещён. Требуются права администратора.'}), 403
        return f(*args, **kwargs)
    return decorated_function


def _collect_minio_stats():
    """Собирает статистику по объектам в бакете MinIO (количество, размер, распределение по проектам)."""
    # Если клиент ещё не инициализирован — инициализируем из .env
    if minio_client is None:
        set_minio_client()
    client = get_minio_client()
    stats = {
        "total_objects": 0,
        "total_size_bytes": 0,
        "projects_count": 0,
        "project_sizes": {},       # project_id -> размер в байтах
        "project_object_counts": {},  # project_id -> число объектов
        "file_type_sizes": {},     # расширение -> суммарный размер
        "file_type_counts": {},    # расширение -> количество
        "newest_object": None,
        "oldest_object": None,
    }

    for obj in client.list_objects(MINIO_BUCKET, recursive=True):
        if obj.object_name.endswith('/'):
            continue

        size = obj.length or 0
        stats["total_objects"] += 1
        stats["total_size_bytes"] += size

        # Распределение по проектам (путь вида projects/{project_id}/...)
        if obj.object_name.startswith(MINIO_PROJECTS_PREFIX):
            rel = obj.object_name[len(MINIO_PROJECTS_PREFIX):]
            parts = rel.split('/')
            if len(parts) >= 2 and parts[0]:
                pid = parts[0]
                stats["project_sizes"][pid] = stats["project_sizes"].get(pid, 0) + size
                stats["project_object_counts"][pid] = stats["project_object_counts"].get(pid, 0) + 1

        # Распределение по расширениям файлов
        name = obj.object_name.rsplit('/', 1)[-1]
        ext = name.rsplit('.', 1)[-1].lower() if '.' in name else 'без расширения'
        stats["file_type_sizes"][ext] = stats["file_type_sizes"].get(ext, 0) + size
        stats["file_type_counts"][ext] = stats["file_type_counts"].get(ext, 0) + 1

        # Самый новый / самый старый объект
        if obj.last_modified:
            lm_iso = obj.last_modified.isoformat()
            if stats["newest_object"] is None or obj.last_modified > stats["newest_object"]["last_modified"]:
                stats["newest_object"] = {"name": obj.object_name, "last_modified": obj.last_modified, "iso": lm_iso}
            if stats["oldest_object"] is None or obj.last_modified < stats["oldest_object"]["last_modified"]:
                stats["oldest_object"] = {"name": obj.object_name, "last_modified": obj.last_modified, "iso": lm_iso}

    stats["projects_count"] = len(stats["project_sizes"])
    return stats


def _parse_log_line(line):
    """Разбирает строку лога формата: [дд.мм.гггг чч:мм:сс] УРОВЕНЬ : сообщение ..."""
    m = re.match(r'^\[([\d.\s:]+)\]\s+(?:\[(\w+)\])?\s*(\w+)\s*:?(.*)$', line.strip())
    if not m:
        return None
    ts_raw, tag, level, message = m.groups()
    try:
        ts = datetime.strptime(ts_raw.strip(), '%d.%m.%Y %H:%M:%S')
    except ValueError:
        return None
    return {"timestamp": ts, "tag": tag, "level": level.upper(), "message": (message or '').strip()}


def _analyze_logs(filename, tail_lines=5000):
    """Анализирует файл логов: уровни, активность по часам, топ ошибок, частые эндпоинты."""
    path = os.path.join('logs', filename)
    result = {
        "exists": os.path.exists(path),
        "file": filename,
        "lines_total": 0,
        "levels": {},
        "hourly_activity": {},   # 'дд.мм чч' -> количество записей
        "top_errors": [],
        "endpoints": {},         # путь запроса -> количество упоминаний
        "last_entry": None,
    }
    if not result["exists"]:
        return result

    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            all_lines = fh.readlines()
    except Exception as e:
        app_logger.error(f"Ошибка чтения лога {filename}: {e}")
        return result

    result["lines_total"] = len(all_lines)
    lines = all_lines[-tail_lines:]  # анализируем только хвост файла

    error_counter = {}
    endpoint_re = re.compile(r'(?:для|URL|path)[:\s]+(/[^\s,"\']+)', re.IGNORECASE)

    for line in lines:
        parsed = _parse_log_line(line)
        if not parsed:
            continue
        level = parsed["level"]
        result["levels"][level] = result["levels"].get(level, 0) + 1

        hour_key = parsed["timestamp"].strftime('%d.%m %H:00')
        result["hourly_activity"][hour_key] = result["hourly_activity"].get(hour_key, 0) + 1

        if level in ("ERROR", "CRITICAL"):
            # Нормализуем сообщение для подсчёта повторов
            key = re.sub(r'\d+', 'N', parsed["message"])[:200]
            error_counter[key] = error_counter.get(key, 0) + 1

        m_ep = endpoint_re.search(parsed["message"])
        if m_ep:
            ep = m_ep.group(1)
            result["endpoints"][ep] = result["endpoints"].get(ep, 0) + 1

        if result.get("_last_dt") is None or parsed["timestamp"] > result["_last_dt"]:
            result["_last_dt"] = parsed["timestamp"]
            result["last_entry"] = {"timestamp": parsed["timestamp"].strftime('%d.%m.%Y %H:%M:%S'),
                                    "level": level, "message": parsed["message"][:300]}

    result.pop("_last_dt", None)  # служебное поле не отдаём клиенту
    result["top_errors"] = sorted(error_counter.items(), key=lambda kv: kv[1], reverse=True)[:10]
    result["endpoints"] = dict(sorted(result["endpoints"].items(), key=lambda kv: kv[1], reverse=True)[:20])
    return result


@app.route('/admin/dashboard')
@require_admin
def admin_dashboard_page():
    """Страница административного дашборда анализа."""
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wtis_admin_dashboard.html')
    if not os.path.exists(html_path):
        app_logger.error("Файл wtis_admin_dashboard.html не найден")
        abort(404)
    response = make_response(send_from_directory('.', 'wtis_admin_dashboard.html'))
    response.headers['Cache-Control'] = 'no-cache'
    return response


@app.route('/api/admin/stats', methods=['GET'])
@require_admin
def admin_stats():
    """Сводная аналитика для администратора: состояние сервера, статистика MinIO, анализ логов."""
    try:
        minio_ok = True
        minio_error = None
        minio_stats = {}
        try:
            minio_stats = _collect_minio_stats()
        except Exception as e:
            minio_ok = False
            minio_error = str(e)
            app_logger.error(f"Админ-статистика: ошибка сбора данных MinIO: {e}", exc_info=True)

        logs_dir = 'logs'
        log_files = []
        if os.path.isdir(logs_dir):
            for fn in os.listdir(logs_dir):
                fp = os.path.join(logs_dir, fn)
                if os.path.isfile(fp):
                    log_files.append({
                        "name": fn,
                        "size_bytes": os.path.getsize(fp),
                        "modified": datetime.fromtimestamp(os.path.getmtime(fp)).isoformat(),
                    })

        app_log_analysis = _analyze_logs('app.log')
        requests_log_analysis = _analyze_logs('requests.log')

        # Топ проектов по размеру
        top_projects = sorted(minio_stats.get("project_sizes", {}).items(),
                              key=lambda kv: kv[1], reverse=True)[:10]

        payload = {
            "success": True,
            "generated_at": datetime.now().isoformat(),
            "server": {
                "status": "healthy" if minio_ok else "degraded",
                "minio": "ok" if minio_ok else "error",
                "minio_error": minio_error,
                "bucket": MINIO_BUCKET,
                "endpoint": MINIO_ENDPOINT,
                "python_version": sys.version.split()[0],
            },
            "storage": {
                "total_objects": minio_stats.get("total_objects", 0),
                "total_size_bytes": minio_stats.get("total_size_bytes", 0),
                "projects_count": minio_stats.get("projects_count", 0),
                "file_type_sizes": minio_stats.get("file_type_sizes", {}),
                "file_type_counts": minio_stats.get("file_type_counts", {}),
                "top_projects_by_size": [{"id": pid, "size_bytes": sz} for pid, sz in top_projects],
                "project_object_counts": minio_stats.get("project_object_counts", {}),
                "newest_object": minio_stats.get("newest_object", {}).get("iso") if minio_stats.get("newest_object") else None,
                "oldest_object": minio_stats.get("oldest_object", {}).get("iso") if minio_stats.get("oldest_object") else None,
            },
            "logs": {
                "files": log_files,
                "app": app_log_analysis,
                "requests": requests_log_analysis,
            }
        }
        return jsonify(payload), 200
    except Exception as e:
        app_logger.error(f"Ошибка формирования админ-статистики: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/admin/logs/<filename>', methods=['GET'])
@require_admin
def admin_logs_tail(filename):
    """Возвращает последние N строк указанного файла логов."""
    allowed = {'app.log', 'requests.log'}
    if filename not in allowed:
        return jsonify({"error": "Недопустимое имя файла логов"}), 400

    n = min(int(request.args.get('lines', 200)), 5000)
    path = os.path.join('logs', filename)
    if not os.path.exists(path):
        return jsonify({"error": "Файл логов не найден"}), 404

    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            lines = fh.readlines()
        return jsonify({
            "success": True,
            "file": filename,
            "lines": [ln.rstrip('\n') for ln in lines[-n:]]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':

    # Запускаем сервер
    print(f"Server starting...")
    print(f"Open http://127.0.0.1:15404 in your browser")
    set_minio_client()
    app.run(debug=True, host='0.0.0.0', port=15404)