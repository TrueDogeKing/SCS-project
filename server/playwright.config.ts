/// <reference types="node" />
import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname } from "path";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
  },
  webServer: {
    command: "bun run src/api.ts",
    cwd: currentDir,
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
