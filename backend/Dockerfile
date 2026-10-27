FROM golang:1.26.10-alpine3.24 AS build

WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/calculator ./cmd/server

FROM alpine:3.24.0

RUN addgroup -S -g 10001 calculator \
    && adduser -S -D -H -u 10001 -G calculator calculator
COPY --from=build /out/calculator /usr/local/bin/calculator
USER 10001:10001
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/calculator"]
