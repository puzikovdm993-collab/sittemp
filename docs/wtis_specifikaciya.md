# Спецификация

## WTIS (Web-based Tomograph Instrumental System)

---

**Лист утверждения**

| | |
|---|---|
| УТВЕРЖДАЮ | |
| Руководитель проекта | |
| _________________ / _____________________ / | |
| «___» ______________ 202__ г. | |

---

**Титульный лист**

| | |
|---|---|
| | **Спецификация** |
| | **программы WTIS** |
| | **(Web-based Tomograph Instrumental System)** |
| | |
| | Обозначение: WTIS.01.001.00 |
| | Редакция: 01 |
| | |
| | 2025 |

---

## 1. Документация

| № | Обозначение | Наименование | Примечание |
|---|-------------|--------------|------------|
| 1 | WTIS.01.001.01 | Техническое задание на разработку WTIS | |
| 2 | WTIS.01.001.02 | Спецификация программы WTIS | Настоящий документ |
| 3 | WTIS.01.001.03 | Пояснительная записка (технический проект) | |
| 4 | WTIS.01.001.04 | Руководство оператора | |
| 5 | WTIS.01.001.05 | Руководство программиста | Планируется |
| 6 | WTIS.01.001.06 | Программа и методика испытаний | Планируется |

| |
|---|
| *(свободные строки для дополнительных записей)* |
| |
| |

---

## 2. Комплексы

| № | Обозначение | Наименование | Примечание |
|---|-------------|--------------|------------|
| — | — | — | WTIS не входит в состав более крупного комплекса |

| |
|---|
| *(свободные строки)* |
| |
| |

---

## 3. Компоненты

| № | Обозначение | Наименование | Примечание |
|---|-------------|--------------|------------|
| 1 | WTIS.CORE | Ядро приложения (src/) | Инициализация, глобальное состояние, управление файлами, история |
| 2 | WTIS.CORE.GLOBALS | Глобальные переменные и конфигурация | src/globals/globals.js |
| 3 | WTIS.CORE.MAIN | Инициализация приложения | src/main/main.js |
| 4 | WTIS.CORE.FILEMANAGER | Управление файлами (открытие, закрытие, переключение) | src/fileManager/fileManager.js |
| 5 | WTIS.CORE.HISTORY | История операций (Undo/Redo) | src/history/history.js |
| 6 | WTIS.CORE.MODELS | Модели данных | src/models/models.js |
| 7 | WTIS.CORE.DRAWING | Отрисовка на Canvas | src/drawing/drawing.js |
| 8 | WTIS.CORE.DB | IndexedDB + MinIO sync | src/db.js |
| 9 | WTIS.CORE.WORKER | Web Worker (медианный фильтр) | src/worker/medianFilterWorker.js |
| 10 | WTIS.CORE.SERVER | MinIO file browser (Total Commander style) | src/server/server.js |
| 11 | WTIS.UI.PROJECTS | Страница управления проектами | wtis_projects.html + src/wtis-projects/ |
| 12 | WTIS.UI.WORKSPACE | Редактор изображений (TIS) | wtis_workspace.html |
| 13 | WTIS.UI.WORKFLOW | Конвейер обработки (node-graph) | wtis_workflow.html |
| 14 | WTIS.KERNEL.APPROXIMATION | Аппроксимация поверхности (МНК) | src/imageOps/kernels/approximation.js |
| 15 | WTIS.KERNEL.NORMALISATION | Нормализация матрицы | src/imageOps/kernels/normalisation.js |
| 16 | WTIS.KERNEL.LOGARITHM | Логарифмическое преобразование | src/imageOps/kernels/logarithm.js |
| 17 | WTIS.KERNEL.MEDIAN | Медианный фильтр | src/imageOps/kernels/median.js |
| 18 | WTIS.KERNEL.SOBEL | Фильтр Собеля (детекция границ) | src/imageOps/kernels/sobel.js |
| 19 | WTIS.KERNEL.THRESHOLD | Пороговая обработка | src/imageOps/kernels/threshold.js |
| 20 | WTIS.KERNEL.DIVISION | Поэлементное деление матриц | src/imageOps/kernels/division.js |
| 21 | WTIS.KERNEL.ROTATE | Поворот матрицы | src/imageOps/kernels/rotate.js |
| 22 | WTIS.KERNEL.SHIFT | Сдвиг матрицы | src/imageOps/kernels/shift.js |
| 23 | WTIS.KERNEL.CROP | Обрезка (вырезание области) | src/imageOps/kernels/crop.js |
| 24 | WTIS.KERNEL.POLAR | Преобразование в полярные координаты | src/imageOps/kernels/polar.js |
| 25 | WTIS.KERNEL.COMMON | Общие утилиты ядер | src/imageOps/kernels/common.js |
| 26 | WTIS.WF.FILTERS | Узлы фильтров workflow | components/worflow/filtres/ |
| 27 | WTIS.WF.TRANSFORM | Узлы трансформаций workflow | components/worflow/TransformNode/ |
| 28 | WTIS.WF.SEARCH | Узлы поиска workflow | components/worflow/Search/ |
| 29 | WTIS.WF.CALC | Узлы вычислений workflow | components/worflow/CalculationNode/ |
| 30 | WTIS.WF.ROI | Узлы ROI workflow | components/worflow/roi/ |
| 31 | WTIS.VIS.MATRIX | 3D визуализация матрицы (Plotly) | src/matrix/matrix.js |
| 32 | WTIS.VIS.PROFILE | Профиль (линия сечения) | src/matrix/ (profile) |
| 33 | WTIS.BE.SERVER | Flask-сервер (API + статика) | app.py |
| 34 | WTIS.BE.MINIO | Интеграция с MinIO (хранилище) | app.py (minio client) |

> **Примечание.** WTIS является веб-портом существующего десктопного C# приложения. Алгоритм Tracing (компонент WTIS.WF.ROI, узел trasing.js) перенесён из C# класса TracingFilterEffectPlugin. Остальные ядра разработаны заново на JavaScript.

| |
|---|
| *(свободные строки для дополнительных записей)* |
| |
| |
| |

---

## 4. Входные и выходные данные

### 4.1. Входные данные

| Компонент | Тип | Формат | Описание |
|-----------|-----|--------|----------|
| Загрузка изображения | Файл | PNG, JPG, JPEG | Растровое изображение |
| Загрузка матрицы | Файл | TPT | Текстовая матрица (числа, разделители: пробел/запятая) |
| Загрузка матрицы (NumPy) | Файл | .npy | Бинарная матрица NumPy |
| Загрузка workflow | Файл | JSON | Описание графа узлов |
| Параметры фильтров | Числа | — | Размер ядра, порог, степень полинома и др. |
| ROI | Координаты | — | Вершины прямоугольника / полигона |
| Колормап | Строка | enum | Название карты (gray, hot, jet, viridis и др.) |

### 4.2. Выходные данные

| Компонент | Тип | Формат | Описание |
|-----------|-----|--------|----------|
| Обработанная матрица | Матрица | float32/float64 | Результат применения операции |
| Экспорт изображения | Файл | PNG | Визуализация матрицы |
| Экспорт workflow | Файл | JSON | Граф с параметрами узлов |
| Профиль | Массив | float[] | Значения вдоль сечения |
| 3D-график | Визуализация | Plotly | Поверхностный график |
| История | Массив | JSON | Последовательность операций |

---

## 5. Свободные строки

| |
|---|
| *(дополнительные записи)* |
| |
| |
| |
| |

---

*Предварительная версия. Подлежит согласованию и утверждению.*

