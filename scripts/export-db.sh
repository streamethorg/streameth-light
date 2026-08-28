#!/usr/bin/env bash
# Re-runs the production DB export via the VPS.
#
# The streameth-platform mongo isn't reachable directly from a laptop — it's a
# container on the app's private Docker network (DB_HOST=mongodb resolves only
# there). This script SSHes into the VPS, briefly starts the mongodb container
# if it's stopped, runs the export inside a throwaway node container attached
# to that same Docker network, copies the resulting JSON back into ./data,
# and restores the mongodb container to whatever state it found it in.
set -euo pipefail

SCRIPT_DIR_EARLY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR_EARLY/.env.export" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR_EARLY/.env.export"
fi
if [ -z "${DB_PASSWORD:-}" ]; then
  echo "Set DB_PASSWORD in scripts/.env.export (see scripts/.env.export.example)" >&2
  exit 1
fi

SSH_HOST="streameth@pblvrt.com"
MONGO_CONTAINER="mongodb-es0w4g8ssw4oc40cs4owcg0k-115231265510"
NETWORK="es0w4g8ssw4oc40cs4owcg0k"
REMOTE_DIR="/tmp/streameth-export-$$"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

was_running=$(ssh "$SSH_HOST" "docker inspect -f '{{.State.Running}}' $MONGO_CONTAINER" 2>/dev/null || echo "false")

if [ "$was_running" != "true" ]; then
  echo "Starting $MONGO_CONTAINER (was stopped)..."
  ssh "$SSH_HOST" "docker start $MONGO_CONTAINER" >/dev/null
  sleep 5
fi

ssh "$SSH_HOST" "mkdir -p $REMOTE_DIR/data"
scp "$SCRIPT_DIR/remote-export.mjs" "$SSH_HOST:$REMOTE_DIR/export-db.mjs" >/dev/null

echo "Running export on VPS..."
ssh "$SSH_HOST" "docker run --rm --network $NETWORK -e DB_PASSWORD='$DB_PASSWORD' -v $REMOTE_DIR:/app -w /app node:22-slim sh -c 'npm install mongodb --silent >/dev/null 2>&1 && node export-db.mjs'"

echo "Copying data back..."
DATA_DIR="$SCRIPT_DIR/../data"
mkdir -p "$DATA_DIR"
for f in events organizations sessions speakers stages; do
  scp "$SSH_HOST:$REMOTE_DIR/data/$f.json" "$DATA_DIR/" >/dev/null
done

echo "Cleaning up VPS temp files..."
ssh "$SSH_HOST" "docker run --rm -v $REMOTE_DIR:/cleanup node:22-slim sh -c 'rm -rf /cleanup/*' && rmdir $REMOTE_DIR" >/dev/null

if [ "$was_running" != "true" ]; then
  echo "Stopping $MONGO_CONTAINER (restoring original state)..."
  ssh "$SSH_HOST" "docker stop $MONGO_CONTAINER" >/dev/null
fi

echo "Done. Updated data/*.json"
