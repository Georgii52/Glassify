#!/bin/sh
set -eu

DOMAIN="${NGINX_CERT_DOMAIN:-ansara-test1.ru}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
FULLCHAIN="${LIVE_DIR}/fullchain.pem"
PRIVKEY="${LIVE_DIR}/privkey.pem"

# If Let's Encrypt cert isn't present yet, create a temporary self-signed cert
# so nginx can start and serve the HTTP-01 challenge on port 80.
if [ ! -s "${FULLCHAIN}" ] || [ ! -s "${PRIVKEY}" ]; then
  echo "SSL cert for ${DOMAIN} not found; generating temporary self-signed cert."
  mkdir -p "${LIVE_DIR}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -subj "/CN=${DOMAIN}" \
    -keyout "${PRIVKEY}" \
    -out "${FULLCHAIN}" >/dev/null 2>&1 || true
fi

exec nginx -g "daemon off;"

