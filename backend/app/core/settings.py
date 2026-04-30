from pathlib import Path
from os import getenv
from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = BACKEND_ROOT / "data"

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = getenv(
    "DATABASE_URL",
    "postgresql://localhost:5432/dom_action_effect_extractor",
)
