FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock* ./
COPY server/package.json server/bun.lock* ./server/

RUN cd server && bun install

COPY server/src ./server/src
COPY server/tsconfig.json ./server/

EXPOSE 3001

CMD ["bun", "run", "--cwd", "./server", "src/api.ts"]

