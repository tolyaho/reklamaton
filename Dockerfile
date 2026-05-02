FROM node:20-slim

# Python 3, pip, and lsof (used by dev CMD to free ports)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip lsof \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend dependencies
COPY reklamaton/requirements.txt ./reklamaton/
RUN pip3 install --break-system-packages --no-cache-dir -r reklamaton/requirements.txt

# Frontend dependencies
COPY my-app/package.json my-app/package-lock.json ./my-app/
RUN cd my-app && npm ci

# Application source
COPY reklamaton/ ./reklamaton/
COPY my-app/ ./my-app/

EXPOSE 8000 5174

# Dev servers: API + Vite (not optimized for production traffic)
CMD ["sh", "-c", "lsof -ti tcp:8000 | xargs kill -9 2>/dev/null || true; cd /app/reklamaton && uvicorn main:app --reload --host 0.0.0.0 --port 8000 & cd /app/my-app && npm run dev -- --host 0.0.0.0 --port 5174"]
