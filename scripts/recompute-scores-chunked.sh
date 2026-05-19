#!/bin/bash
# Run recompute-leaderboard-scores.js in 5000-row chunks to avoid Supabase timeout.
set -e
cd "$(dirname "$0")/.."

TOTAL=69186
CHUNK=5000
OFFSET=0

while [ $OFFSET -lt $TOTAL ]; do
  echo ">>> Scoring rows $OFFSET – $((OFFSET + CHUNK - 1)) ..."
  node scripts/recompute-leaderboard-scores.js --offset $OFFSET --limit $CHUNK
  OFFSET=$((OFFSET + CHUNK))
  sleep 2
done

echo ">>> All chunks done."
