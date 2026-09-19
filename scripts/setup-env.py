"""Create local environment files without replacing existing configuration."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parent.parent
for name in ("backend", "mobile"):
    target = root / name / ".env"
    if not target.exists():
        content = (root / name / ".env.example").read_text()
        content = content.replace("replace-with-at-least-32-random-characters", secrets.token_urlsafe(48))
        target.write_text(content)
        target.chmod(0o600)
        print(f"Created {name}/.env")
