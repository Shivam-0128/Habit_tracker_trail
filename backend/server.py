from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from starlette.middleware.cors import CORSMiddleware

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc)

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude={"id"})
        if self.id:
            data["_id"] = ObjectId(self.id)
        return data


class User(BaseDocument):
    display_name: str
    email: str
    password_hash: str = ""
    created_at: str = ""


class Habit(BaseDocument):
    owner_id: PyObjectId
    name: str
    when_i_do_it: str = ""
    shared: bool = False
    completed_dates: List[str] = []
    created_at: str = ""


class Comment(BaseDocument):
    habit_id: PyObjectId
    author_id: PyObjectId
    author_name: str
    text: str
    created_at: str = ""


class RegisterIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class HabitIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    when_i_do_it: str = Field(default="", max_length=2000)
    shared: bool = False


class TickIn(BaseModel):
    date: str
    done: bool


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access", "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def public_user(u: User):
    return {"id": u.id, "display_name": u.display_name, "email": u.email}


def auth_response(response: Response, u: User):
    token = make_token(u.id)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"user": public_user(u), "token": token}


async def current_user(request: Request) -> User:
    token = request.cookies.get("access_token")
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid or expired session")
    doc = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not doc:
        raise HTTPException(401, "User not found")
    return User.from_mongo(doc)


def streak_of(dates: List[str]) -> int:
    if not dates:
        return 0
    days = set(date.fromisoformat(d) for d in dates)
    d = max(days)
    count = 0
    while d in days:
        count += 1
        d -= timedelta(days=1)
    return count


async def owner_names(ids):
    docs = await db.users.find({"_id": {"$in": [ObjectId(i) for i in set(ids)]}}).to_list(1000)
    return {str(d["_id"]): d["display_name"] for d in docs}


def habit_out(h: Habit, owner_name: str, me: User):
    return {
        "id": h.id, "name": h.name, "when_i_do_it": h.when_i_do_it, "shared": h.shared,
        "owner_id": h.owner_id, "owner_name": owner_name, "is_owner": h.owner_id == me.id,
        "completed_dates": sorted(h.completed_dates), "days_done": len(h.completed_dates),
        "current_streak": streak_of(h.completed_dates), "created_at": h.created_at,
    }


async def get_visible_habit(habit_id: str, me: User) -> Habit:
    if not ObjectId.is_valid(habit_id):
        raise HTTPException(404, "Habit not found")
    doc = await db.habits.find_one({"_id": ObjectId(habit_id)})
    if not doc:
        raise HTTPException(404, "Habit not found")
    h = Habit.from_mongo(doc)
    if not h.shared and h.owner_id != me.id:
        raise HTTPException(404, "Habit not found")
    return h


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    u = User(display_name=body.display_name.strip(), email=email,
             password_hash=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(), created_at=now_iso())
    res = await db.users.insert_one(u.to_mongo())
    u.id = str(res.inserted_id)
    return auth_response(response, u)


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    doc = await db.users.find_one({"email": body.email.lower()})
    if not doc or not bcrypt.checkpw(body.password.encode(), doc["password_hash"].encode()):
        raise HTTPException(401, "Wrong email or password")
    return auth_response(response, User.from_mongo(doc))


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: User = Depends(current_user)):
    return public_user(user)


@api.get("/habits/mine")
async def my_habits(user: User = Depends(current_user)):
    docs = await db.habits.find({"owner_id": user.id}).sort("created_at", -1).to_list(1000)
    return [habit_out(Habit.from_mongo(d), user.display_name, user) for d in docs]


@api.post("/habits")
async def add_habit(body: HabitIn, user: User = Depends(current_user)):
    h = Habit(owner_id=user.id, name=body.name.strip(), when_i_do_it=body.when_i_do_it.strip(),
              shared=body.shared, created_at=now_iso())
    res = await db.habits.insert_one(h.to_mongo())
    h.id = str(res.inserted_id)
    return habit_out(h, user.display_name, user)


@api.get("/habits/community")
async def community(user: User = Depends(current_user)):
    docs = await db.habits.find({"shared": True}).sort("created_at", -1).to_list(1000)
    habits = [Habit.from_mongo(d) for d in docs]
    names = await owner_names([h.owner_id for h in habits])
    return [habit_out(h, names.get(h.owner_id, "Unknown"), user) for h in habits]


@api.get("/habits/{habit_id}")
async def get_habit(habit_id: str, user: User = Depends(current_user)):
    h = await get_visible_habit(habit_id, user)
    names = await owner_names([h.owner_id])
    return habit_out(h, names.get(h.owner_id, "Unknown"), user)


@api.put("/habits/{habit_id}/ticks")
async def tick(habit_id: str, body: TickIn, user: User = Depends(current_user)):
    h = await get_visible_habit(habit_id, user)
    if h.owner_id != user.id:
        raise HTTPException(403, "Only the owner can change this habit")
    if not DATE_RE.match(body.date):
        raise HTTPException(400, "Invalid date")
    op = "$addToSet" if body.done else "$pull"
    await db.habits.update_one({"_id": ObjectId(h.id)}, {op: {"completed_dates": body.date}})
    doc = await db.habits.find_one({"_id": ObjectId(h.id)})
    return habit_out(Habit.from_mongo(doc), user.display_name, user)


@api.get("/habits/{habit_id}/comments")
async def list_comments(habit_id: str, user: User = Depends(current_user)):
    h = await get_visible_habit(habit_id, user)
    docs = await db.comments.find({"habit_id": h.id}).sort("created_at", 1).to_list(1000)
    return [Comment.from_mongo(d).model_dump() for d in docs]


@api.post("/habits/{habit_id}/comments")
async def post_comment(habit_id: str, body: CommentIn, user: User = Depends(current_user)):
    h = await get_visible_habit(habit_id, user)
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Comment cannot be empty")
    c = Comment(habit_id=h.id, author_id=user.id, author_name=user.display_name, text=text, created_at=now_iso())
    res = await db.comments.insert_one(c.to_mongo())
    c.id = str(res.inserted_id)
    return c.model_dump()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.habits.create_index("owner_id")
    await db.habits.create_index("shared")
    await db.comments.create_index("habit_id")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
