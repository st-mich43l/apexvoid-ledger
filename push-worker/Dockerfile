FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /push-worker .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H worker
USER worker
COPY --from=build /push-worker /push-worker
ENTRYPOINT ["/push-worker"]
