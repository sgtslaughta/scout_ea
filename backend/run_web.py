import uvicorn
from pathlib import Path
from ea import db
from web.app import create_app

p = Path("ea.sqlite")
db.init_db(p, seed_path=db.DEFAULT_SEED)
static_dir = Path("frontend_dist") if Path("frontend_dist").is_dir() else None
app = create_app(p, static_dir=static_dir)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
