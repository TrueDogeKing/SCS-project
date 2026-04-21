/**
 * Server Logging utilities
 * Writes timestamped security events to daily-rotated log files.
 *
 * Log files produced:
 *   ./logs/server.log              – all events (append)
 *   ./logs/server-YYYY-MM-DD.log   – daily rotation, all events
 *   ./logs/server-security.log     – security-relevant events only
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { LogEntry, LogLevel, LogEventType, SECURITY_EVENTS } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = resolve(__dirname, "../../logs");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function localTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

function dateStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatLogEntry(entry: LogEntry): string {
  const parts: string[] = [
    entry.timestamp,
    entry.level,
    entry.event,
  ];

  if (entry.clientId) parts.push(`client_id=${entry.clientId}`);
  if (entry.serverId) parts.push(`server_id=${entry.serverId}`);
  if (entry.message) parts.push(`message="${entry.message}"`);

  if (entry.details) {
    for (const [key, value] of Object.entries(entry.details)) {
      parts.push(`${key}=${value}`);
    }
  }

  return parts.join(" ");
}


export function log(options: {
  level: LogLevel;
  event: LogEventType;
  clientId?: string;
  serverId?: string;
  message?: string;
  details?: Record<string, string | number | boolean>;
}): void {
  const timestamp = localTimestamp();

  const entry: LogEntry = {
    timestamp,
    level: options.level,
    event: options.event,
    clientId: options.clientId,
    serverId: options.serverId,
    message: options.message,
    details: options.details,
  };

  const formatted = formatLogEntry(entry);

  const color =
    options.level === "SUCCESS"
      ? "\x1b[32m"
      : options.level === "ERROR"
        ? "\x1b[31m"
        : options.level === "WARN"
          ? "\x1b[33m"
          : "\x1b[36m";
  const reset = "\x1b[0m";
  console.log(`${color}[SERVER]${reset} ${formatted}`);

  ensureLogDir();

  const mainLog = resolve(LOG_DIR, "server.log");
  appendFileSync(mainLog, formatted + "\n", "utf-8");

  const dailyLog = resolve(LOG_DIR, `server-${dateStamp()}.log`);
  appendFileSync(dailyLog, formatted + "\n", "utf-8");

  if (SECURITY_EVENTS.has(options.event)) {
    const securityLog = resolve(LOG_DIR, "server-security.log");
    appendFileSync(securityLog, formatted + "\n", "utf-8");
  }
}


type LogOptions = Omit<Parameters<typeof log>[0], "level" | "event">;

export function logInfo(event: LogEventType, options?: LogOptions) {
  log({ ...options, level: "INFO", event });
}

export function logSuccess(event: LogEventType, options?: LogOptions) {
  log({ ...options, level: "SUCCESS", event });
}

export function logWarn(event: LogEventType, options?: LogOptions) {
  log({ ...options, level: "WARN", event });
}

export function logError(event: LogEventType, options?: LogOptions) {
  log({ ...options, level: "ERROR", event });
}
