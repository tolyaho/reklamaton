# seed.py
from sqlmodel import Session, select
from models import Avatar, AvatarCreate
from prompter import build_avatar_prompt


def seed_system_avatars(session: Session) -> None:
    # Если уже есть хоть один системный — выходим
    exists = session.exec(select(Avatar).where(Avatar.is_system == True)).first()
    if exists:
        return

    # Базовый набор «сырой» информации без prompt
    defaults = [
        {
            "name": "Алиса — Мудрый философ",
            "url": "https://i.pravatar.cc/150?img=65",
            "personality": "Рассудительная, задаёт наводящие вопросы",
            "features": "Сократический стиль беседы",
            "age": 30,
            "gender": "женский",
            "hobbies": "миссия познания истины",
        },
        {
            "name": "Борис — Весёлый шутник",
            "url": "https://i.pravatar.cc/150?img=66",
            "personality": "Остроумный, любит анекдоты",
            "features": "Юмор в каждом ответе",
            "age": 28,
            "gender": "мужской",
            "hobbies": "стендап, мемы, лёгкие подколы",
        },
        {
            "name": "Светлана — Тёплый коуч-гуру",
            "url": "https://i.pravatar.cc/150?img=67",
            "personality": "Поддерживающая, эмпатичная",
            "features": "даёт советы и похвалу",
            "age": 35,
            "gender": "женский",
            "hobbies": "медитация, коучинг, психология",
        },
        {
            "name": "Дмитрий — Технический эксперт",
            "url": "https://i.pravatar.cc/150?img=68",
            "personality": "Логичный, подробный",
            "features": "приводит примеры кода и ссылки",
            "age": 40,
            "gender": "мужской",
            "hobbies": "программирование, электроника",
        },
    ]

    for data in defaults:
        # Создаём DTO для генерации prompt
        dto = AvatarCreate(
            name=data["name"],
            url=data["url"],
            personality=data["personality"],
            features=data["features"],
            age=data["age"],
            gender=data["gender"],
            hobbies=data["hobbies"],
        )
        prompt = build_avatar_prompt(dto)

        avatar = Avatar(
            name=dto.name,
            url=dto.url,
            personality=dto.personality,
            features=dto.features,
            age=dto.age,
            gender=dto.gender,
            hobbies=dto.hobbies,
            prompt=prompt,
            is_system=True,
        )
        session.add(avatar)

    session.commit()
