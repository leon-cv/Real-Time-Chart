# Build Stage
FROM golang:1.25.5-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /data_collector ./cmd

# Run Stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /data_collector /app/data_collector

# Create a non-root user
RUN adduser -D nonroot
USER nonroot
