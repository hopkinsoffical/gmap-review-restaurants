#!/usr/bin/env bash
# Run one SMS schedule slot (morning | noon | evening). Used by macOS LaunchAgents.
# Loads .env.local via Python dotenv inside scheduled_sms_pipeline.py.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "Missing venv: $PY — run: python3 -m venv .venv && .venv/bin/pip install -r pipelines/requirements.txt" >&2
  exit 1
fi
SLOT="${1:-}"
if [[ "$SLOT" != "morning" && "$SLOT" != "noon" && "$SLOT" != "evening" ]]; then
  echo "Usage: $0 morning|noon|evening" >&2
  exit 2
fi
exec "$PY" "$ROOT/scripts/scheduled_sms_pipeline.py" --slot "$SLOT" --send
