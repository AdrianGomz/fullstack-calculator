FROM node:24.21.0-alpine3.24 AS build

WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30.6-alpine3.24

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
# The configuration is complete; no root-only entrypoint rewrites are needed.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
