# Regression tests for Habit Circle: auth, habits, ticks/streak, community, comments, permissions
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def _register(name):
    email = f"test_{name.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"display_name": f"TEST_{name}", "email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def owner():
    return _register("Owner")


@pytest.fixture(scope="module")
def other():
    return _register("Other")


# --- Auth ---
class TestAuth:
    def test_register_returns_user_and_token(self, owner):
        assert owner["user"]["display_name"] == "TEST_Owner"
        assert isinstance(owner["token"], str) and owner["token"]
        assert "password_hash" not in owner["user"]

    def test_duplicate_register(self, owner):
        r = requests.post(f"{API}/auth/register", json={"display_name": "x", "email": owner["email"], "password": "secret123"})
        assert r.status_code == 400

    def test_login_ok_and_cookie(self, owner):
        r = requests.post(f"{API}/auth/login", json={"email": owner["email"], "password": "secret123"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == owner["email"]
        assert "access_token" in r.headers.get("set-cookie", "").lower() or "access_token" in r.cookies
        assert "httponly" in r.headers.get("set-cookie", "").lower()

    def test_login_wrong_password(self, owner):
        r = requests.post(f"{API}/auth/login", json={"email": owner["email"], "password": "wrong"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Wrong email or password"

    def test_alice_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "alice@example.com", "password": "alice123"})
        assert r.status_code == 200

    def test_me(self, owner):
        r = requests.get(f"{API}/auth/me", headers=owner["h"])
        assert r.status_code == 200 and r.json()["id"] == owner["user"]["id"]

    def test_me_unauth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401


# --- Habits, ticks, permissions, community, comments ---
class TestHabits:
    @pytest.fixture(scope="class")
    def habits(self, owner):
        s = requests.post(f"{API}/habits", headers=owner["h"], json={"name": "TEST_Shared", "when_i_do_it": "Morning", "shared": True}).json()
        p = requests.post(f"{API}/habits", headers=owner["h"], json={"name": "TEST_Private", "when_i_do_it": "Night"}).json()
        return s, p

    def test_create_defaults(self, habits):
        s, p = habits
        assert s["shared"] is True and p["shared"] is False
        assert p["days_done"] == 0 and p["current_streak"] == 0

    def test_mine_only_own(self, owner, other, habits):
        mine = requests.get(f"{API}/habits/mine", headers=owner["h"]).json()
        ids = {h["id"] for h in mine}
        assert {habits[0]["id"], habits[1]["id"]} <= ids
        assert all(h["owner_id"] == owner["user"]["id"] for h in mine)
        theirs = requests.get(f"{API}/habits/mine", headers=other["h"]).json()
        assert not ({h["id"] for h in theirs} & ids)

    def test_ticks_and_streak(self, owner, habits):
        hid = habits[0]["id"]
        t = date.today()
        days = [(t - timedelta(days=i)).isoformat() for i in range(7)]
        for d in [days[0], days[1], days[3]]:
            r = requests.put(f"{API}/habits/{hid}/ticks", headers=owner["h"], json={"date": d, "done": True})
            assert r.status_code == 200
        d = r.json()
        assert d["days_done"] == 3 and d["current_streak"] == 2
        r = requests.put(f"{API}/habits/{hid}/ticks", headers=owner["h"], json={"date": days[0], "done": False})
        assert r.json()["days_done"] == 2 and r.json()["current_streak"] == 1
        # persisted
        g = requests.get(f"{API}/habits/{hid}", headers=owner["h"]).json()
        assert sorted(g["completed_dates"]) == sorted([days[1], days[3]])
        # idempotent tick
        requests.put(f"{API}/habits/{hid}/ticks", headers=owner["h"], json={"date": days[1], "done": True})
        assert requests.get(f"{API}/habits/{hid}", headers=owner["h"]).json()["days_done"] == 2

    def test_non_owner_tick_forbidden(self, other, habits):
        r = requests.put(f"{API}/habits/{habits[0]['id']}/ticks", headers=other["h"], json={"date": date.today().isoformat(), "done": True})
        assert r.status_code == 403

    def test_private_hidden(self, other, habits):
        pid = habits[1]["id"]
        assert requests.get(f"{API}/habits/{pid}", headers=other["h"]).status_code == 404
        assert requests.get(f"{API}/habits/{pid}/comments", headers=other["h"]).status_code == 404
        assert requests.post(f"{API}/habits/{pid}/comments", headers=other["h"], json={"text": "hi"}).status_code == 404

    def test_community(self, other, habits):
        com = requests.get(f"{API}/habits/community", headers=other["h"]).json()
        ids = {h["id"] for h in com}
        assert habits[0]["id"] in ids and habits[1]["id"] not in ids
        assert all(h["shared"] for h in com)
        item = next(h for h in com if h["id"] == habits[0]["id"])
        assert item["owner_name"] == "TEST_Owner" and item["when_i_do_it"] == "Morning" and item["days_done"] == 2

    def test_comments(self, owner, other, habits):
        hid = habits[0]["id"]
        r = requests.post(f"{API}/habits/{hid}/comments", headers=other["h"], json={"text": "TEST_ nice"})
        assert r.status_code == 200
        c = r.json()
        assert c["author_name"] == "TEST_Other" and c["id"]
        lst = requests.get(f"{API}/habits/{hid}/comments", headers=owner["h"]).json()
        assert any(x["id"] == c["id"] and x["text"] == "TEST_ nice" and "_id" not in x for x in lst)

    def test_empty_comment_rejected(self, other, habits):
        r = requests.post(f"{API}/habits/{habits[0]['id']}/comments", headers=other["h"], json={"text": "   "})
        assert r.status_code in (400, 422)

    def test_invalid_date_rejected(self, owner, habits):
        r = requests.put(f"{API}/habits/{habits[1]['id']}/ticks", headers=owner["h"], json={"date": "bad", "done": True})
        assert r.status_code == 400

    def test_impossible_date_does_not_break_habit(self, owner):
        h = requests.post(f"{API}/habits", headers=owner["h"], json={"name": "TEST_BadDate"}).json()
        r = requests.put(f"{API}/habits/{h['id']}/ticks", headers=owner["h"], json={"date": "2026-13-45", "done": True})
        assert r.status_code == 400, f"Impossible date accepted: {r.status_code}"
        assert requests.get(f"{API}/habits/{h['id']}", headers=owner["h"]).status_code == 200

    def test_unauth_habits(self):
        assert requests.get(f"{API}/habits/mine").status_code == 401
        assert requests.get(f"{API}/habits/community").status_code == 401

    def test_invalid_id_404(self, owner):
        assert requests.get(f"{API}/habits/notanid", headers=owner["h"]).status_code == 404
