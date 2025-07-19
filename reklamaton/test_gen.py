#!/usr/bin/env python3
import os
import time
import requests
import logging

# ——— CONFIG ———
BASE_URL = os.getenv("API_BASE", "http://127.0.0.1:8000")
USERNAME = os.getenv("USERNAME", "test@example.com")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "3"))

# ——— SETUP LOGGER ———
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def get_or_create_user():
    url = f"{BASE_URL}/users/"
    payload = {"username": USERNAME}
    logging.info("Ensuring user exists: %s", payload)
    resp = requests.post(url, json=payload)
    resp.raise_for_status()
    user = resp.json()
    logging.info("User record: %s", user)
    return user["id"]


def create_test_avatar(user_id: int):
    url = f"{BASE_URL}/users/{user_id}/avatars/"
    payload = {
        "name": "Тестовый Аватар",
        "personality": "Дружелюбный и любознательный",
        "features": "Всегда задаёт вопросы",
        "age": 42,
        "gender": "не указан",
        "hobbies": "тестирование API"
    }
    logging.info("Создаём аватар: %s", payload)
    resp = requests.post(url, json=payload)
    try:
        resp.raise_for_status()
    except Exception:
        logging.error("Ошибка при создании аватара %s: %s", resp.status_code, resp.text)
        raise
    avatar = resp.json()
    logging.info("Создан аватар: %s", avatar)
    return avatar["id"]


def poll_avatar(avatar_id: int):
    url = f"{BASE_URL}/avatars/{avatar_id}/"
    attempt = 1
    while True:
        logging.info("Опрос статуса (попытка %d)...", attempt)
        resp = requests.get(url)
        try:
            resp.raise_for_status()
        except Exception:
            logging.error("Ошибка при опросе %s: %s", resp.status_code, resp.text)
            raise
        data = resp.json()
        status = data.get("image_status")
        logging.info("Текущий статус: %s", status)
        if status in ("ready", "failed"):
            if status == "ready":
                logging.info("Готово! URL: %s", data.get("image_url"))
            else:
                logging.warning("Генерация не удалась")
            break
        attempt += 1
        time.sleep(POLL_INTERVAL)


def main():
    logging.info("=== Тест генерации аватара ===")
    user_id = get_or_create_user()
    avatar_id = create_test_avatar(user_id)
    logging.info("Ждём окончания фоновой генерации…")
    poll_avatar(avatar_id)
    logging.info("=== Готово ===")


if __name__ == "__main__":
    main()
