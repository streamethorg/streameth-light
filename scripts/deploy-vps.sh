#!/usr/bin/env bash
# Deploys streameth-light to the VPS: pulls the branch on the server, builds
# the Docker image, swaps the running container behind Traefik and installs
# the weekly digest cron. Usage: scripts/deploy-vps.sh [branch] (default main).
#
# Needs /home/streameth/streameth-light.env on the VPS (see README "Deploy").
set -euo pipefail

BRANCH="${1:-main}"
HOST="streameth@pblvrt.com"
REPO="https://github.com/streamethorg/streameth-light.git"

ssh "$HOST" BRANCH="$BRANCH" REPO="$REPO" bash -s <<'REMOTE'
set -euo pipefail
APP=streameth-light
DIR="$HOME/$APP"
ENV_FILE="$HOME/$APP.env"

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }
[ -d "$DIR/.git" ] || git clone "$REPO" "$DIR"
cd "$DIR"
git fetch --prune origin
git checkout -B "$BRANCH" "origin/$BRANCH"
SHA=$(git rev-parse --short HEAD)
echo "building $APP @ $BRANCH ($SHA)"

DOCKER_BUILDKIT=1 docker build --secret id=env,src="$ENV_FILE" \
  -t "$APP:$SHA" -t "$APP:latest" .

docker rm -f "$APP" >/dev/null 2>&1 || true
# Two routers so each gets its own certificate: a Let's Encrypt request for a
# host that doesn't point here yet would otherwise fail for every host on it.
docker run -d \
  --name "$APP" \
  --restart unless-stopped \
  --network coolify \
  --env-file "$ENV_FILE" \
  -l traefik.enable=true \
  -l "traefik.http.services.$APP.loadbalancer.server.port=3000" \
  -l "traefik.http.routers.$APP.rule=Host(\`streameth.org\`) || Host(\`www.streameth.org\`)" \
  -l "traefik.http.routers.$APP.entrypoints=https" \
  -l "traefik.http.routers.$APP.tls.certresolver=letsencrypt" \
  -l "traefik.http.routers.$APP.service=$APP" \
  -l "traefik.http.routers.$APP.middlewares=$APP-www" \
  -l "traefik.http.middlewares.$APP-www.redirectregex.regex=^https://www\\.streameth\\.org/(.*)" \
  -l "traefik.http.middlewares.$APP-www.redirectregex.replacement=https://streameth.org/\${1}" \
  -l "traefik.http.middlewares.$APP-www.redirectregex.permanent=true" \
  -l "traefik.http.routers.$APP-pblvrt.rule=Host(\`$APP.pblvrt.com\`)" \
  -l "traefik.http.routers.$APP-pblvrt.entrypoints=https" \
  -l "traefik.http.routers.$APP-pblvrt.tls.certresolver=letsencrypt" \
  -l "traefik.http.routers.$APP-pblvrt.service=$APP" \
  "$APP:latest"

# Weekly digest, Mondays 09:00 UTC. Runs inside the container so CRON_SECRET
# stays in the env file instead of the crontab.
CRON_LINE="0 9 * * 1 docker exec $APP node -e \"fetch('http://localhost:3000/api/digest/send',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>{console.log(new Date().toISOString(),r.status,await r.text())})\" >> \$HOME/$APP-digest.log 2>&1"
( crontab -l 2>/dev/null | grep -v "api/digest/send" || true; echo "$CRON_LINE" ) | crontab -

# Keep the current and previous image for rollback.
docker images "$APP" --format '{{.Tag}}' | grep -v -e latest -e "$SHA" | tail -n +2 \
  | xargs -r -I{} docker rmi "$APP:{}" >/dev/null 2>&1 || true

for i in $(seq 1 30); do
  if docker exec "$APP" node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"; then
    echo "$APP @ $SHA is up"; exit 0
  fi
  sleep 2
done
echo "$APP did not come up — docker logs $APP" >&2
exit 1
REMOTE
