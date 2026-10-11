from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DATABASE_FILE = DATA_DIR / "app.db"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_ROWS = 100_000
MAX_COLUMNS = 100

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)