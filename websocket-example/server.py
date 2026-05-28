"""
Простой WebSocket сервер на Python с использованием библиотеки websockets.

Этот сервер:
1. Принимает подключения от клиентов
2. Отправляет приветственное сообщение
3. Эхо-ответ на все полученные сообщения
4. Обрабатывает команды (например, /time, /count)
5. Отслеживает количество подключенных клиентов
"""

import asyncio
import json
from datetime import datetime
import websockets

# Глобальный счетчик подключенных клиентов
connected_clients = set()
message_count = 0


async def handle_client(websocket):
    """Обработка подключения клиента."""
    global message_count
    
    # Добавляем клиента в множество подключенных
    connected_clients.add(websocket)
    
    # Отправляем приветственное сообщение
    welcome_message = {
        "type": "welcome",
        "message": "Добро пожаловать на WebSocket сервер!",
        "timestamp": datetime.now().isoformat(),
        "connected_clients": len(connected_clients)
    }
    await websocket.send(json.dumps(welcome_message, ensure_ascii=False))
    
    print(f"Клиент подключился. Всего клиентов: {len(connected_clients)}")
    
    try:
        # Бесконечный цикл для получения сообщений от клиента
        async for message in websocket:
            message_count += 1
            
            # Парсим полученное сообщение
            try:
                data = json.loads(message)
                client_message = data.get("message", "")
                command = data.get("command", "")
            except json.JSONDecodeError:
                # Если сообщение не JSON, считаем его простым текстом
                client_message = message
                command = ""
            
            # Обработка команд
            response = {}
            
            if command == "time":
                response = {
                    "type": "command_response",
                    "command": "time",
                    "data": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "message": "Текущее время сервера"
                }
            elif command == "count":
                response = {
                    "type": "command_response",
                    "command": "count",
                    "data": {
                        "connected_clients": len(connected_clients),
                        "total_messages": message_count
                    },
                    "message": "Статистика сервера"
                }
            elif command == "broadcast":
                # Рассылка сообщения всем клиентам
                broadcast_data = {
                    "type": "broadcast",
                    "message": client_message,
                    "from": "client",
                    "timestamp": datetime.now().isoformat()
                }
                await broadcast_to_all(broadcast_data, exclude=websocket)
                response = {
                    "type": "confirmation",
                    "message": "Сообщение отправлено всем клиентам"
                }
            else:
                # Обычное эхо-сообщение
                response = {
                    "type": "echo",
                    "original_message": client_message,
                    "server_response": f"Получено: {client_message}",
                    "message_number": message_count,
                    "timestamp": datetime.now().isoformat()
                }
            
            # Отправляем ответ клиенту
            await websocket.send(json.dumps(response, ensure_ascii=False))
            
    except websockets.exceptions.ConnectionClosed:
        print("Клиент отключился")
    finally:
        # Удаляем клиента из множества при отключении
        connected_clients.discard(websocket)
        print(f"Клиент отключился. Всего клиентов: {len(connected_clients)}")


async def broadcast_to_all(message, exclude=None):
    """Рассылка сообщения всем подключенным клиентам."""
    if connected_clients:
        # Создаем копию множества, чтобы избежать изменения во время итерации
        clients = connected_clients.copy()
        
        if exclude:
            clients.discard(exclude)
        
        # Асинхронная рассылка всем клиентам
        await asyncio.gather(
            *[client.send(json.dumps(message, ensure_ascii=False)) 
              for client in clients],
            return_exceptions=True
        )


async def main():
    """Запуск WebSocket сервера."""
    host = "localhost"
    port = 8765
    
    print(f"Запуск WebSocket сервера на ws://{host}:{port}")
    print("Ожидание подключений...")
    print("Доступные команды:")
    print("  /time - получить текущее время")
    print("  /count - получить статистику")
    print("  /broadcast <сообщение> - отправить сообщение всем клиентам")
    print("-" * 50)
    
    # Запуск сервера
    async with websockets.serve(handle_client, host, port):
        await asyncio.Future()  # Бесконечное ожидание


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nСервер остановлен пользователем")
