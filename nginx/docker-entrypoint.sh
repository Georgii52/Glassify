#!/bin/sh
set -eu

DOMAIN="${NGINX_CERT_DOMAIN:-trello-analog.ru}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
FULLCHAIN="${LIVE_DIR}/fullchain.pem"
PRIVKEY="${LIVE_DIR}/privkey.pem"
LE_ALT_CHAIN="/etc/letsencrypt/live/${DOMAIN}-0001/fullchain.pem"

is_le_cert() {
  _f="$1"
  [ -s "${_f}" ] && openssl x509 -in "${_f}" -noout -issuer 2>/dev/null | grep -q "Let's Encrypt"
}

# Какой каталог live/* подставить в nginx (certbot иногда создаёт trello-analog.ru-0001)
SSL_DOMAIN="${DOMAIN}"
if is_le_cert "${FULLCHAIN}"; then
  SSL_DOMAIN="${DOMAIN}"
elif is_le_cert "${LE_ALT_CHAIN}"; then
  SSL_DOMAIN="${DOMAIN}-0001"
  echo "Using Let's Encrypt files at live/${SSL_DOMAIN}/ (duplicate lineage)."
fi

# Временный self-signed только если нет ни одного LE-серта
if ! is_le_cert "${FULLCHAIN}" && ! is_le_cert "${LE_ALT_CHAIN}"; then
  if [ ! -s "${FULLCHAIN}" ] || [ ! -s "${PRIVKEY}" ]; then
    echo "SSL cert for ${DOMAIN} not found; generating temporary self-signed cert."
    mkdir -p "${LIVE_DIR}"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -subj "/CN=${DOMAIN}" \
      -keyout "${PRIVKEY}" \
      -out "${FULLCHAIN}" >/dev/null 2>&1 || true
  fi
fi

sed "s|__CERT_DOMAIN__|${SSL_DOMAIN}|g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
