FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# HtmlWebpackPlugin подставляет API_URL в index.html; .env в образ не попадает (.dockerignore)
ARG API_URL
ENV API_URL=$API_URL

RUN npm run build

FROM nginx:stable-alpine AS runtime

COPY nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

