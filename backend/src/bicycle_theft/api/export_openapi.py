"""Write the OpenAPI document to backend/openapi.json. The frontend's `pnpm generate:api` reads it
to regenerate src/client, so run this after changing any endpoint or schema."""

import json

from bicycle_theft.api.app import app
from bicycle_theft.paths import REPO_ROOT

OUTPUT = REPO_ROOT / "backend" / "openapi.json"


def main() -> None:
    OUTPUT.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
