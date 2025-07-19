# Project

## reklamaton folder - backend part
Если хотите удалить базу данных:

```bash
lsof -ti tcp:8000 | xargs kill -9
rm database.db
uvicorn main:app --reload
```

Если нет
```bash
lsof -ti tcp:8000 | xargs kill -9
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
