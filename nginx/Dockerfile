FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/nginx.conf.template

RUN apk add --no-cache openssl

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]