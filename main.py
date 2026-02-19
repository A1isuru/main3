# simplified_main.py - без JWT токенов
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import json
import uuid
from datetime import datetime
from passlib.context import CryptContext
import aiofiles
from pathlib import Path

# Модели
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class ContentCreate(BaseModel):
    title: str
    content: str
    author: str
    user_id: str

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# Конфигурация - используем sha256_crypt вместо bcrypt (нет ограничения 72 байта)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
DATA_DIR = Path("data")
USERS_FILE = DATA_DIR / "users.json"
CONTENT_FILE = DATA_DIR / "content.json"
SESSIONS = {}

# Инициализация
def init_files():
    DATA_DIR.mkdir(exist_ok=True)
    
    if not USERS_FILE.exists():
        default_users = [{
            "id": "admin-id",
            "username": "admin",
            "password": pwd_context.hash("admin123"),
            "created_at": datetime.now().isoformat()
        }]
        USERS_FILE.write_text(json.dumps(default_users, indent=2))
    
    if not CONTENT_FILE.exists():
        default_content = [{
            "id": "welcome-id",
            "title": "Добро пожаловать",
            "content": "Первая статья",
            "author": "admin",
            "user_id": "admin-id",
            "date": datetime.now().isoformat()
        }]
        CONTENT_FILE.write_text(json.dumps(default_content, indent=2))

init_files()

async def read_json(file_path: Path):
    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
        return json.loads(await f.read())

async def write_json(file_path: Path, data):
    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
        await f.write(json.dumps(data, indent=2, ensure_ascii=False))

# Простая аутентификация без JWT
def create_session(user_id: str) -> str:
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "user_id": user_id,
        "created_at": datetime.now().isoformat()
    }
    return session_id

def get_user_from_session(session_id: str):
    if session_id in SESSIONS:
        return SESSIONS[session_id]
    return None

# API
@app.get("/")
async def index():
    return FileResponse("static/index.html")

@app.get("/dashboard")
async def dashboard():
    return FileResponse("static/dashboard.html")

@app.post("/api/register")
async def register(user: UserCreate):
    print(f"=== РЕГИСТРАЦИЯ ===")
    print(f"Username: {user.username}")
    print(f"Password length: {len(user.password)} chars")
    
    users = await read_json(USERS_FILE)
    
    for u in users:
        if u["username"] == user.username:
            print(f"Пользователь {user.username} уже существует!")
            raise HTTPException(400, "Пользователь существует")
    
    # Хэшируем пароль и выводим результат
    hashed_password = pwd_context.hash(user.password)
    print(f"Hashed password (first 50 chars): {hashed_password[:50]}")
    
    new_user = {
        "id": str(uuid.uuid4()),
        "username": user.username,
        "password": hashed_password,
        "created_at": datetime.now().isoformat()
    }
    
    users.append(new_user)
    await write_json(USERS_FILE, users)
    
    print(f"Пользователь {user.username} создан успешно!")
    print("==================")
    
    return {"success": True, "message": "Регистрация успешна"}

@app.post("/api/login")
async def login(user: UserLogin):
    print(f"=== ВХОД ===")
    print(f"Username: {user.username}")
    print(f"Password: {user.password}")
    
    users = await read_json(USERS_FILE)
    print(f"Всего пользователей в базе: {len(users)}")
    
    for index, u in enumerate(users):
        print(f"Пользователь #{index}: {u['username']}")
        if u["username"] == user.username:
            print(f"✓ Найден пользователь: {u['username']}")
            print(f"ID пользователя: {u['id']}")
            print(f"Хэш в базе: {u['password'][:50]}...")
            
            # Пробуем проверить пароль
            try:
                is_valid = pwd_context.verify(user.password, u["password"])
                print(f"Результат проверки пароля: {is_valid}")
                
                if is_valid:
                    session_id = create_session(u["id"])
                    print(f"✓ Создана сессия: {session_id}")
                    print("==================")
                    return {
                        "success": True,
                        "session_id": session_id,
                        "user": {
                            "id": u["id"],
                            "username": u["username"],
                            "created_at": u["created_at"]
                        }
                    }
                else:
                    print("✗ Пароль неверный")
            except Exception as e:
                print(f"✗ Ошибка при проверке пароля: {e}")
    
    print("✗ Пользователь не найден или пароль неверен")
    print("==================")
    raise HTTPException(401, "Неверные данные")

@app.get("/api/content")
async def get_content(user_id: Optional[str] = None):
    content = await read_json(CONTENT_FILE)
    
    if user_id:
        return [item for item in content if item["user_id"] == user_id]
    return content

@app.post("/api/content")
async def create_content(content: ContentCreate, request: Request):
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(401, "Не авторизован")
    
    content_data = await read_json(CONTENT_FILE)
    
    new_item = {
        "id": str(uuid.uuid4()),
        **content.dict(),
        "date": datetime.now().isoformat()
    }
    
    content_data.append(new_item)
    await write_json(CONTENT_FILE, content_data)
    
    return {"success": True, "id": new_item["id"]}

@app.delete("/api/content/{item_id}")
async def delete_content(item_id: str, request: Request):
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(401, "Не авторизован")
    
    content = await read_json(CONTENT_FILE)
    user_id = SESSIONS[session_id]["user_id"]
    
    # Проверяем владельца
    item_to_delete = None
    for item in content:
        if item["id"] == item_id:
            item_to_delete = item
            break
    
    if not item_to_delete:
        raise HTTPException(404, "Статья не найдена")
    
    if item_to_delete["user_id"] != user_id:
        raise HTTPException(403, "Нет прав")
    
    content = [item for item in content if item["id"] != item_id]
    await write_json(CONTENT_FILE, content)
    
    return {"success": True}

@app.get("/api/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("Сервер запущен: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)