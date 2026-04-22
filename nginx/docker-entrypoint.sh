#!/bin/sh
set -eu

DOMAIN="${NGINX_CERT_DOMAIN:-trello-analog.ru}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
FULLCHAIN="${LIVE_DIR}/fullchain.pem"
PRIVKEY="${LIVE_DIR}/privkey.pem"

# Если Let's Encrypt ещё не выдавал сертификат — временный self-signed, чтобы nginx поднялся и отдал HTTP-01
if [ ! -s "${FULLCHAIN}" ] || [ ! -s "${PRIVKEY}" ]; then
  echo "SSL cert for ${DOMAIN} not found; generating temporary self-signed cert."
  mkdir -p "${LIVE_DIR}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -subj "/CN=${DOMAIN}" \
    -keyout "${PRIVKEY}" \
    -out "${FULLCHAIN}" >/dev/null 2>&1 || true
fi

sed "s|__CERT_DOMAIN__|${DOMAIN}|g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
