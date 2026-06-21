import uvicorn
from pathlib import Path
from ea import db
from web.app import create_app

p = Path("ea.sqlite")
db.init_db(p, seed_path=db.DEFAULT_SEED)
app = create_app(p)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
