#!/bin/sh
set -eu
# Run on the n8n host after preparing a private env file. Never overwrite
# an existing encryption key when updating an existing instance.
ENV_FILE=${ENV_FILE:-/opt/ld-latte/n8n.env}
IMAGE='docker.n8n.io/n8nio/n8n@sha256:45edf89655fd66dd55ea9336c1791ad14777599fdbf6c5aec6db583ede99a40b'
test -f "$ENV_FILE"
if grep -q REPLACE_WITH "$ENV_FILE"; then
  echo 'Replace template values before running.' >&2
  exit 1
fi
if docker container inspect ld-latte-n8n >/dev/null 2>&1; then
  echo 'Container already exists. Follow the backup/update procedure.' >&2
  exit 1
fi
docker pull "$IMAGE"
docker volume create ld_latte_n8n_data
docker run -d --name ld-latte-n8n --restart unless-stopped \
  --memory 768m --memory-swap 1g --cpus 0.6 \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  -p 127.0.0.1:5678:5678 \
  --env-file "$ENV_FILE" \
  -v ld_latte_n8n_data:/home/node/.n8n "$IMAGE"
