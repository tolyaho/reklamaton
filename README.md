# Project

## reklamaton folder - backend part
To run, write:
```bash
lsof -ti tcp:8000 | xargs kill -9
rm database.db
uvicorn main:app --reload
```

## my-app folder - frontend part

Изначально нужно установить node

```
brew install node
```

Также нужно

```
npm install
```

Запускать из папки my-app
```
npm run dev
```
