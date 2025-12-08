FROM oven/bun:1.1-alpine

WORKDIR /app

COPY bun.lock package.json ./

RUN bun install

COPY . .