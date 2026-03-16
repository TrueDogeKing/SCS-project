/**
 * TTP Logging utilities
 * Writes timestamped security events to daily-rotated log files.
 *
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { LogEntry, LogLevel, LogEventType, SECURITY_EVENTS } from "./types";

const LOG_DIR = resolve(import.meta.dir, "../../logs");

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

  if (entry.entityId) parts.push(`entity_id=${entry.entityId}`);
  if (entry.entityType) parts.push(`entity_type=${entry.entityType}`);
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
  entityId?: string;
  entityType?: "CLIENT" | "SERVER" | "SYSTEM";
  message?: string;
  details?: Record<string, string | number | boolean>;
}): void {
  const timestamp = localTimestamp();

  const entry: LogEntry = {
    timestamp,
    level: options.level,
    event: options.event,
    entityId: options.entityId,
    entityType: options.entityType,
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
  console.log(`${color}[TTP]${reset} ${formatted}`);

  ensureLogDir();

  const mainLog = resolve(LOG_DIR, "ttp.log");
  appendFileSync(mainLog, formatted + "\n", "utf-8");

  const dailyLog = resolve(LOG_DIR, `ttp-${dateStamp()}.log`);
  appendFileSync(dailyLog, formatted + "\n", "utf-8");

  if (SECURITY_EVENTS.has(options.event)) {
    const securityLog = resolve(LOG_DIR, "ttp-security.log");
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
