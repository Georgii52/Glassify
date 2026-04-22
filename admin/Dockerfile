FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm i

COPY . .

# Vite подставляет только то, что есть в окружении на этапе build (.env в образ не копируется)
ARG VITE_BASE_URL
ARG VITE_COOKIE_NAME=admin_token
ARG VITE_COOKIE_MAX_AGE=604800
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_COOKIE_NAME=$VITE_COOKIE_NAME
ENV VITE_COOKIE_MAX_AGE=$VITE_COOKIE_MAX_AGE

RUN npm run build

FROM nginx:stable-alpine AS runtime

COPY nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

