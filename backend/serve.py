"""Production entry point: initialize DB and serve API+static via uvicorn."""
import os
import uvicorn
from pathlib import Path
from ea import db
from web.app import create_app

if __name__ == "__main__":
    db_path = Path(os.environ.get("EA_DB_PATH", "/data/ea.sqlite"))
    port = int(os.environ.get("EA_WEB_PORT", "8765"))
    static_dir = Path("/app/frontend_dist") if Path("/app/frontend_dist").is_dir() else None
    skills_dir = Path(os.environ.get("SKILLS_DIR", "/app/skills"))

    # Initialize DB if it doesn't exist
    db.init_db(db_path, seed_path=db.DEFAULT_SEED)

    app = create_app(db_path, static_dir=static_dir, skills_dir=skills_dir)
    uvicorn.run(app, host="0.0.0.0", port=port)
