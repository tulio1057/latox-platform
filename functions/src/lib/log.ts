/** Structured JSON logs (collected by Vercel / any log drain). Never log secrets. */
type Level = "info" | "warn" | "error";

function write(level: Level, message: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ severity: level.toUpperCase(), message, ...data, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (m: string, d?: Record<string, unknown>) => write("info", m, d),
  warn: (m: string, d?: Record<string, unknown>) => write("warn", m, d),
  error: (m: string, d?: Record<string, unknown>) => write("error", m, d),
};
