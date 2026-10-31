import os

from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "sqlite:///./database.db"
# SQL echo prints every statement with its parameters (customer names, emails, chat text), so it is
# opt-in for local debugging only.
engine = create_engine(DATABASE_URL, echo=os.getenv("SQL_ECHO") == "1")


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
