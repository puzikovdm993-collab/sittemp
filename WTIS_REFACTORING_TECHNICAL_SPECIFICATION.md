# Техническое задание на рефакторинг архитектуры проекта WTIS

## 1. Общие сведения

### 1.1. Наименование проекта
Система обработки и визуализации рентгеновских изображений WTIS (Web-based Tomography Imaging System).

### 1.2. Цель рефакторинга
Преобразование текущей монолитной архитектуры в модульную, масштабируемую и безопасную систему, соответствующую современным стандартам разработки веб-приложений для медицинской визуализации.

### 1.3. Область применения
Документ предназначен для команды разработки, тестирования и внедрения системы WTIS.

---

## 2. Анализ текущего состояния

### 2.1. Существующие проблемы
1. **Архитектурные недостатки:**
   - Монолитная структура backend без четкого разделения ответственности
   - Глобальные переменные для хранения состояния приложения
   - Отсутствие слоя абстракции для работы с данными
   - Смешение бизнес-логики и логики представления

2. **Проблемы безопасности:**
   - Hardcoded credentials для подключения к MinIO и базе данных
   - Отсутствие CSRF-защиты
   - Недостаточная валидация входных данных
   - Отсутствие аудита действий пользователей

3. **Производительность:**
   - Синхронная обработка тяжелых изображений блокирует основной поток
   - Отсутствие кеширования результатов вычислений
   - Неоптимальные запросы к хранилищу

4. **Тестируемость:**
   - Отсутствие модульных и интеграционных тестов
   - Высокая связность компонентов затрудняет изолированное тестирование

5. **Поддерживаемость:**
   - Дублирование кода в различных модулях
   - Отсутствие единого стиля кодирования
   - Недостаточная документация API

---

## 3. Требования к новой архитектуре

### 3.1. Архитектурные принципы
1. **Разделение ответственности (SoC):**
   - Четкое разделение на слои: Presentation, Business Logic, Data Access
   - Изоляция бизнес-логики от фреймворков и внешних зависимостей

2. **Модульность:**
   - Выделение независимых модулей по функциональным областям
   - Возможность замены отдельных компонентов без влияния на систему

3. **Масштабируемость:**
   - Поддержка горизонтального масштабирования backend-сервисов
   - Возможность распределенной обработки изображений

4. **Безопасность:**
   - Соответствие стандартам безопасности для медицинских данных (HIPAA/GDPR)
   - Принцип минимальных привилегий для всех компонентов

### 3.2. Целевая архитектура

#### 3.2.1. Backend-архитектура
```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer          │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
│   Auth        │  │   Image       │  │   3D          │
│   Service     │  │   Processing  │  │   Rendering   │
│               │  │   Service     │  │   Service     │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
│   PostgreSQL  │  │    MinIO      │  │    Redis      │
│   (Metadata)  │  │   (Storage)   │  │   (Cache)     │
└───────────────┘  └───────────────┘  └───────────────┘
```

#### 3.2.2. Структура проекта
```
wtis/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # Точка входа
│   │   ├── config/                 # Конфигурация
│   │   │   ├── __init__.py
│   │   │   ├── settings.py         # Настройки окружения
│   │   │   └── security.py         # Security настройки
│   │   ├── api/                    # API слой
│   │   │   ├── __init__.py
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── images.py
│   │   │   │   └── reconstruction.py
│   │   │   └── dependencies.py     # DI зависимости
│   │   ├── core/                   # Ядро системы
│   │   │   ├── __init__.py
│   │   │   ├── security.py         # Аутентификация, авторизация
│   │   │   ├── exceptions.py       # Кастомные исключения
│   │   │   └── middleware.py       # Middleware компоненты
│   │   ├── services/               # Бизнес-логика
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── image_service.py
│   │   │   ├── reconstruction_service.py
│   │   │   └── notification_service.py
│   │   ├── repositories/           # Доступ к данным
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Базовый репозиторий
│   │   │   ├── user_repository.py
│   │   │   ├── image_repository.py
│   │   │   └── session_repository.py
│   │   ├── models/                 # Модели данных
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── image.py
│   │   │   └── reconstruction.py
│   │   ├── schemas/                # Pydantic схемы
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── image.py
│   │   │   └── reconstruction.py
│   │   ├── tasks/                  # Асинхронные задачи
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   ├── image_processing.py
│   │   │   └── reconstruction.py
│   │   └── utils/                  # Утилиты
│   │       ├── __init__.py
│   │       ├── logger.py
│   │       ├── validators.py
│   │       └── helpers.py
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── migrations/                 # Миграции БД
│   ├── scripts/                    # Скрипты развертывания
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   ├── utils/
│   │   └── views/
│   ├── public/
│   ├── tests/
│   ├── package.json
│   └── webpack.config.js
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
├── docs/
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## 4. Детальные требования к компонентам

### 4.1. Конфигурация и управление секретами

#### 4.1.1. Требования
- Использование переменных окружения для всех конфигурационных параметров
- Интеграция с HashiCorp Vault или AWS Secrets Manager для продакшена
- Разделение конфигурации по окружениям (dev, staging, production)
- Валидация конфигурации при старте приложения

#### 4.1.2. Реализация
```python
# config/settings.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "WTIS"
    debug: bool = False
    secret_key: str
    database_url: str
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    redis_url: str
    celery_broker_url: str
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

### 4.2. Аутентификация и авторизация

#### 4.2.1. Требования
- JWT-токены с refresh-токенами
- Ролевая модель доступа (Admin, Radiologist, Technician, Viewer)
- Двухфакторная аутентификация (опционально)
- Аудит всех действий пользователей
- Автоматический выход при неактивности

#### 4.2.2. Реализация
```python
# core/security.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
```

### 4.3. Обработка изображений

#### 4.3.1. Требования
- Асинхронная обработка через Celery
- Очередь задач с приоритетами
- Прогресс выполнения задач
- Повторные попытки при ошибках
- Хранение промежуточных результатов

#### 4.3.2. Реализация
```python
# tasks/image_processing.py
from celery import Celery
from app.services.image_service import ImageService
from app.repositories.image_repository import ImageRepository

celery_app = Celery('wtis', broker=settings.celery_broker_url)

@celery_app.task(bind=True, max_retries=3)
def process_image_task(self, image_id: str, processing_type: str):
    try:
        image_repo = ImageRepository()
        image_service = ImageService()
        
        image = image_repo.get_by_id(image_id)
        if not image:
            raise ValueError(f"Image {image_id} not found")
        
        # Обновление статуса
        image_repo.update_status(image_id, "processing")
        
        # Обработка
        result = image_service.process(image, processing_type)
        
        # Сохранение результата
        image_repo.save_result(image_id, result)
        image_repo.update_status(image_id, "completed")
        
        return {"status": "success", "result_id": result.id}
        
    except Exception as exc:
        self.retry(exc=exc, countdown=60)
```

### 4.4. Работа с хранилищем

#### 4.4.1. Требования
- Абстракция над MinIO через интерфейс
- Поддержка нескольких провайдеров хранения (S3, Azure Blob)
- Кеширование часто используемых изображений в Redis
- Шифрование данных при хранении
- Версионирование файлов

#### 4.4.2. Реализация
```python
# repositories/storage_repository.py
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional
import minio
from minio.error import S3Error

class StorageInterface(ABC):
    @abstractmethod
    def upload(self, bucket: str, object_name: str, data: BinaryIO) -> str:
        pass
    
    @abstractmethod
    def download(self, bucket: str, object_name: str) -> BinaryIO:
        pass
    
    @abstractmethod
    def delete(self, bucket: str, object_name: str) -> bool:
        pass
    
    @abstractmethod
    def exists(self, bucket: str, object_name: str) -> bool:
        pass

class MinIOStorage(StorageInterface):
    def __init__(self, endpoint: str, access_key: str, secret_key: str, secure: bool = True):
        self.client = minio.Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
    
    def upload(self, bucket: str, object_name: str, data: BinaryIO) -> str:
        try:
            self.client.put_object(bucket, object_name, data, length=-1, part_size=10*1024*1024)
            return f"{bucket}/{object_name}"
        except S3Error as e:
            raise StorageException(f"Upload failed: {str(e)}")
    
    def download(self, bucket: str, object_name: str) -> BinaryIO:
        try:
            response = self.client.get_object(bucket, object_name)
            return response.read()
        except S3Error as e:
            raise StorageException(f"Download failed: {str(e)}")
    
    def delete(self, bucket: str, object_name: str) -> bool:
        try:
            self.client.remove_object(bucket, object_name)
            return True
        except S3Error:
            return False
    
    def exists(self, bucket: str, object_name: str) -> bool:
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False
```

### 4.5. API дизайн

#### 4.5.1. Требования
- RESTful API с версионированием
- OpenAPI/Swagger документация
- Пагинация, фильтрация, сортировка
- Единообразный формат ошибок
- Rate limiting

#### 4.5.2. Пример эндпоинтов
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/images
POST   /api/v1/images
GET    /api/v1/images/{id}
DELETE /api/v1/images/{id}
POST   /api/v1/images/{id}/process

GET    /api/v1/reconstructions
POST   /api/v1/reconstructions
GET    /api/v1/reconstructions/{id}
GET    /api/v1/reconstructions/{id}/progress

GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}

GET    /api/v1/audit-logs
```

### 4.6. Логирование и мониторинг

#### 4.6.1. Требования
- Структурированное логирование (JSON)
- Разделение логов по уровням (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Корреляция запросов через request ID
- Интеграция с ELK стек или аналогами
- Метрики производительности (Prometheus)
- Трейсинг распределенных транзакций (Jaeger)

#### 4.6.2. Реализация
```python
# utils/logger.py
import logging
import json
from pythonjsonlogger import jsonlogger
from contextvars import ContextVar

request_id_var = ContextVar('request_id', default=None)

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        if request_id := request_id_var.get():
            log_record['request_id'] = request_id
        log_record['level'] = record.levelname
        log_record['service'] = 'wtis-backend'

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    handler = logging.StreamHandler()
    formatter = CustomJsonFormatter('%(asctime)s %(name)s %(levelname)s %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger
```

---

## 5. Требования к безопасности

### 5.1. Защита данных
- Шифрование данных в покое (AES-256)
- Шифрование данных в движении (TLS 1.3)
- Маскирование чувствительных данных в логах
- Регулярная ротация ключей шифрования

### 5.2. Защита API
- CSRF-токены для всех изменяющих операций
- Rate limiting (100 запросов/мин на пользователя)
- Валидация всех входных данных
- SQL injection prevention через параметризованные запросы
- XSS protection через Content-Security-Policy заголовки

### 5.3. Контроль доступа
- RBAC (Role-Based Access Control)
- Принцип наименьших привилегий
- Обязательная аутентификация для всех эндпоинтов кроме health check
- Аудит всех критических операций

### 5.4. Соответствие стандартам
- HIPAA (для медицинских данных)
- GDPR (для персональных данных)
- OWASP Top 10

---

## 6. Требования к тестированию

### 6.1. Типы тестов
1. **Модульные тесты (Unit Tests):**
   - Покрытие бизнес-логики: ≥90%
   - Изолированное тестирование функций и классов
   - Mock внешних зависимостей

2. **Интеграционные тесты:**
   - Тестирование взаимодействия между компонентами
   - Тестирование API эндпоинтов
   - Тестирование работы с БД и хранилищем

3. **End-to-End тесты:**
   - Полные сценарии использования
   - Тестирование пользовательских потоков
   - Автоматизация через Selenium/Cypress

4. **Нагрузочное тестирование:**
   - Проверка под нагрузкой (1000+ одновременных пользователей)
   - Определение узких мест производительности
   - Тестирование отказоустойчивости

### 6.2. Инструменты
- pytest + pytest-cov для модульных тестов
- pytest-asyncio для асинхронных тестов
- TestContainers для интеграционных тестов
- Locust для нагрузочного тестирования
- Cypress для E2E тестов frontend

### 6.3. CI/CD интеграция
- Запуск тестов при каждом commit
- Блокировка merge при падении тестов
- Генерация отчетов о покрытии
- Автоматическое развертывание при успехе

---

## 7. Требования к развертыванию

### 7.1. Контейнеризация
- Docker для всех компонентов
- Multi-stage builds для оптимизации размера образов
- Health checks для всех сервисов
- Логи в stdout/stderr

### 7.2. Оркестрация
- Kubernetes для production окружения
- Helm charts для управления развертыванием
- Auto-scaling на основе метрик
- Rolling updates без простоя

### 7.3. Окружения
- Development (локальное развертывание)
- Staging (полная копия production)
- Production (высокодоступная конфигурация)

### 7.4. Мониторинг и алертинг
- Prometheus + Grafana для метрик
- ELK Stack для логов
- PagerDuty/OpsGenie для алертов
- Dashboards для ключевых метрик

---

## 8. План миграции

### Этап 1: Подготовка (2 недели)
- [ ] Аудит текущего кода
- [ ] Создание новой структуры проекта
- [ ] Настройка CI/CD пайплайна
- [ ] Разработка стандартов кодирования
- [ ] Обучение команды

### Этап 2: Базовая инфраструктура (3 недели)
- [ ] Реализация системы конфигурации
- [ ] Настройка логирования и мониторинга
- [ ] Внедрение системы секретов
- [ ] Создание базовых моделей и схем
- [ ] Реализация репозиториев

### Этап 3: Безопасность (2 недели)
- [ ] Система аутентификации и авторизации
- [ ] Внедрение CSRF защиты
- [ ] Аудит и логирование действий
- [ ] Валидация входных данных
- [ ] Пенетрационное тестирование

### Этап 4: Бизнес-логика (4 недели)
- [ ] Миграция сервисов обработки изображений
- [ ] Реализация асинхронных задач
- [ ] Интеграция с MinIO
- [ ] Оптимизация запросов к БД
- [ ] Кеширование

### Этап 5: API и Frontend (3 недели)
- [ ] Реализация нового API
- [ ] Миграция frontend на новую архитектуру
- [ ] Интеграция WebSocket для прогресса задач
- [ ] Документирование API
- [ ] End-to-end тестирование

### Этап 6: Тестирование и оптимизация (2 недели)
- [ ] Полное покрытие тестами
- [ ] Нагрузочное тестирование
- [ ] Оптимизация производительности
- [ ] Исправление выявленных проблем
- [ ] Финальный аудит безопасности

### Этап 7: Внедрение (1 неделя)
- [ ] Развертывание на staging
- [ ] UAT тестирование
- [ ] Постепенный rollout на production
- [ ] Мониторинг и сбор обратной связи
- [ ] Отключение старой системы

**Общая длительность:** 17 недель (~4 месяца)

---

## 9. Критерии приемки

### 9.1. Функциональные критерии
- Все существующие функции работают корректно
- Производительность не хуже текущей (или улучшена на 20%+)
- Полная обратная совместимость API (или версияционирование)
- Успешное прохождение всех автоматических тестов

### 9.2. Нефункциональные критерии
- Покрытие кода тестами ≥85%
- Время ответа API <200ms (p95)
- Доступность системы ≥99.9%
- Отсутствие критических уязвимостей безопасности
- Успешное прохождение нагрузочного тестирования

### 9.3. Документация
- Актуальная OpenAPI спецификация
- Руководство по развертыванию
- Руководство для разработчиков
- changelog всех изменений

---

## 10. Риски и меры по их снижению

| Риск | Вероятность | Влияние | Меры снижения |
|------|-------------|---------|---------------|
| Потеря данных при миграции | Низкая | Критическое | Полное резервное копирование, поэтапная миграция |
| Простои системы | Средняя | Высокое | Развертывание в режиме blue-green, быстрый rollback |
| Несоответствие требованиям безопасности | Средняя | Критическое | Раннее вовлечение security-специалистов, регулярные аудиты |
| Превышение сроков | Высокая | Среднее | Итеративная разработка, приоритизация функций, буфер времени |
| Сопротивление команды | Средняя | Среднее | Обучение, вовлечение в процесс, четкая коммуникация |

---

## 11. Приложения

### Приложение А. Глоссарий
- **RBAC** - Role-Based Access Control
- **CSRF** - Cross-Site Request Forgery
- **JWT** - JSON Web Token
- **DI** - Dependency Injection
- **SoC** - Separation of Concerns
- **E2E** - End-to-End

### Приложение Б. Ссылки на стандарты
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [GDPR](https://gdpr.eu/)
- [12 Factor App](https://12factor.net/)

### Приложение В. Контакты ответственных
- Технический лидер: [TBD]
- Архитектор: [TBD]
- Менеджер проекта: [TBD]
- Security officer: [TBD]

---

**Документ утвержден:**
- Дата: [Дата утверждения]
- Подпись технического директора: _______________
- Подпись руководителя проекта: _______________
