import os
import sys
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine

# The backend uses flat imports (`from models import ...`), as when uvicorn runs from reklamaton/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Never reach OpenAI from tests, even if a local .env holds a real key: load_dotenv() does not
# override variables that are already set.
os.environ["OPENAI_API_KEY"] = ""


@pytest.fixture
def session():
    import models  # noqa: F401  (registers the tables)

    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    """The real FastAPI app through TestClient, in a temporary working directory (keyless)."""
    import importlib

    from fastapi.testclient import TestClient

    workdir = tmp_path_factory.mktemp("api")
    cwd = os.getcwd()
    os.chdir(workdir)  # database.db and static/ are created relative to the working directory
    try:
        main = importlib.import_module("main")
        with TestClient(main.app) as c:
            yield c
    finally:
        os.chdir(cwd)
