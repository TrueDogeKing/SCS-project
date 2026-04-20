FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock* ./
COPY ttp/package.json ttp/bun.lock* ./ttp/

RUN cd ttp && bun install

COPY ttp/src ./ttp/src
COPY ttp/tsconfig.json ./ttp/

EXPOSE 3002

CMD ["bun", "run", "--cwd", "./ttp", "src/api.ts"]

