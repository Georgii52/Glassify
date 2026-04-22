FROM nginx:stable-alpine

# Шаблон: entrypoint подставляет домен и пишет /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf.template

RUN apk add --no-cache openssl

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]