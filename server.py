import json
import os
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import cgi

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data.db"
UPLOAD_DIR = ROOT / "uploads"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

UPLOAD_DIR.mkdir(exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                video_url TEXT NOT NULL,
                source_type TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


class Handler(SimpleHTTPRequestHandler):
    def _json(self, data, status=200):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _error(self, message, status=400):
        self._json({"error": message}, status=status)

    def do_GET(self):
        if self.path == "/api/posts":
            with get_db() as conn:
                rows = conn.execute(
                    "SELECT id, title, description, video_url, source_type, created_at FROM posts ORDER BY id DESC"
                ).fetchall()
            posts = [
                {
                    "id": row["id"],
                    "title": row["title"],
                    "description": row["description"] or "",
                    "videoUrl": row["video_url"],
                    "sourceType": row["source_type"],
                    "createdAt": row["created_at"],
                }
                for row in rows
            ]
            return self._json(posts)

        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/posts":
            return self._error("Not found", status=404)

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self._error("Use multipart/form-data")

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type},
        )

        title = (form.getfirst("title") or "").strip()
        description = (form.getfirst("description") or "").strip()
        video_url = (form.getfirst("videoUrl") or "").strip()
        file_item = form["videoFile"] if "videoFile" in form else None

        if not title:
            return self._error("Please add a title.")
        if not video_url and (not file_item or not getattr(file_item, "file", None)):
            return self._error("Provide a video URL or upload a file.")

        source_type = "url"
        stored_url = video_url

        if file_item is not None and getattr(file_item, "file", None):
            data = file_item.file.read(MAX_UPLOAD_BYTES + 1)
            if len(data) > MAX_UPLOAD_BYTES:
                return self._error("File too large (max 25MB).", status=413)
            ext = Path(file_item.filename or "upload.mp4").suffix or ".mp4"
            filename = f"{uuid.uuid4().hex}{ext}"
            file_path = UPLOAD_DIR / filename
            with open(file_path, "wb") as out:
                out.write(data)
            stored_url = f"/uploads/{filename}"
            source_type = "file"

        created_at = datetime.now(timezone.utc).isoformat()

        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO posts (title, description, video_url, source_type, created_at) VALUES (?, ?, ?, ?, ?)",
                (title, description, stored_url, source_type, created_at),
            )
            post_id = cur.lastrowid

        return self._json(
            {
                "id": post_id,
                "title": title,
                "description": description,
                "videoUrl": stored_url,
                "sourceType": source_type,
                "createdAt": created_at,
            },
            status=201,
        )

    def do_DELETE(self):
        if self.path != "/api/posts":
            return self._error("Not found", status=404)

        with get_db() as conn:
            rows = conn.execute("SELECT video_url, source_type FROM posts").fetchall()
            conn.execute("DELETE FROM posts")

        for row in rows:
            if row["source_type"] == "file" and row["video_url"].startswith("/uploads/"):
                path = ROOT / row["video_url"].lstrip("/")
                if path.exists():
                    path.unlink()

        return self._json({"ok": True})


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving on http://localhost:{port}")
    server.serve_forever()
