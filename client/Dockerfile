FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock* ./
COPY client/package.json client/bun.lock* ./client/

RUN cd client && bun install

COPY client/src ./client/src
COPY client/public ./client/public
COPY client/index.html ./client/
COPY client/tsconfig.json ./client/
COPY client/tsconfig.app.json ./client/
COPY client/tsconfig.node.json ./client/
COPY client/vite.config.ts ./client/
COPY client/eslint.config.js ./client/

ENV VITE_SERVER_URL=http://localhost:3001
ENV VITE_TTP_URL=http://localhost:3002

EXPOSE 5173

CMD ["bun", "run", "--cwd", "./client", "dev", "--", "--host"]

