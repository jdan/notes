#!/usr/bin/env bash
set -euo pipefail

host="${NOTES_HOST:-hetzner}"
app_dir="${NOTES_APP_DIR:-/opt/notes}"

ssh "$host" "mkdir -p '$app_dir' '$app_dir/site' '$app_dir/data'"

rsync -az --delete \
	--exclude .git \
	--exclude .env \
	--exclude '.env*' \
	--exclude build \
	--exclude build_tmp \
	--exclude coverage \
	--exclude node_modules \
	--exclude site \
	./ "$host:$app_dir/"

ssh "$host" "cd '$app_dir' \
	&& test -f .env \
	&& if ! grep -q '^WEBHOOK_SECRET=' .env; then printf '\nWEBHOOK_SECRET=%s\n' \"\$(openssl rand -hex 32)\" >> .env; fi \
	&& docker build -t notes:latest . \
	&& (docker rm -f notes 2>/dev/null || true) \
	&& docker run -d --name notes --restart unless-stopped --network kamal --env-file '$app_dir/.env' -e HOST=0.0.0.0 -e PORT=3000 -e BUILD=/app/site -e SQLITE_DB_FILE=/data/db.sqlite3 -v '$app_dir/site:/app/site' -v '$app_dir/data:/data' notes:latest \
	&& docker exec kamal-proxy kamal-proxy deploy notes --host notes.jordanscales.com --target notes:3000 --health-check-path /healthz --tls --deploy-timeout 60s"
