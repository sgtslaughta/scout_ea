import uvicorn
from pathlib import Path
from ea import db
from web.app import create_app
from lib.push_worker import start_push_worker

p = Path("ea.sqlite")
db.init_db(p, seed_path=db.DEFAULT_SEED)
static_dir = Path("frontend_dist") if Path("frontend_dist").is_dir() else None
# skills_dir relative to the backend dir, not the CWD
backend_dir = Path(__file__).parent
skills_dir = backend_dir.parent / "skills" if (backend_dir.parent / "skills").is_dir() else None
app = create_app(p, static_dir=static_dir, skills_dir=skills_dir)

if __name__ == "__main__":
    start_push_worker(p)
    uvicorn.run(app, host="127.0.0.1", port=8765)
