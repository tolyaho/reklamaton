# Project

## reklamaton folder - backend part
To run, write:
```bash
lsof -ti tcp:8000 | xargs kill -9
rm database.db
uvicorn main:app --reload
```

## my-app folder - frontend part
