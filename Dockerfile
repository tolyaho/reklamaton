FROM node:20-slim

# Устанавливаем Python 3, pip и утилиты
RUN apt-get update \
    && apt-get install -y python3 python3-pip lsof \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -------------------------------
# Установим зависимости бекенда
# -------------------------------
COPY reklamaton/requirements.txt ./reklamaton/
# Разрешаем установку пакетов поверх системных ограничений (PEP 668)
RUN pip3 install --break-system-packages --no-cache-dir -r reklamaton/requirements.txt

# -------------------------------
# Установим зависимости фронтенда
# -------------------------------
COPY my-app/package.json my-app/package-lock.json ./my-app/
RUN cd my-app && npm ci

# -------------------------------
# Копируем исходники
# -------------------------------
COPY reklamaton/ ./reklamaton/
COPY my-app/ ./my-app/

# Открываем порты для разработки
EXPOSE 8000 5173

# Запускаем backend и frontend параллельно
CMD ["sh", "-c", "lsof -ti tcp:8000 | xargs kill -9 || true && cd /app/reklamaton && uvicorn main:app --reload --host 0.0.0.0 --port 8000 & cd /app/my-app && npm run dev -- --host 0.0.0.0 --port 5173"]
