/**
 * Ring buffer global para los últimos N mensajes de consola.
 * Se instala una sola vez (idempotente) y permite leer el contexto
 * de logs recientes al reportar un bug.
 */
const MAX = 50;
const buffer: string[] = [];
let installed = false;

function push(level: string, args: unknown[]): void {
  try {
    const ts = new Date().toISOString().slice(11, 23);
    const text = args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        if (typeof a === "object") {
          try { return JSON.stringify(a).slice(0, 500); } catch { return String(a); }
        }
        return String(a);
      })
      .join(" ");
    buffer.push(`[${ts}] ${level}: ${text}`.slice(0, 1000));
    if (buffer.length > MAX) buffer.shift();
  } catch {
    /* swallow */
  }
}

export function installConsoleBuffer(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  console.log = (...a) => { push("log", a); orig.log(...a); };
  console.info = (...a) => { push("info", a); orig.info(...a); };
  console.warn = (...a) => { push("warn", a); orig.warn(...a); };
  console.error = (...a) => { push("error", a); orig.error(...a); };
  window.addEventListener("error", (e) => push("error", [e.message]));
  window.addEventListener("unhandledrejection", (e) => push("error", [`unhandled: ${String(e.reason)}`]));
}

export function getConsoleSnapshot(): string[] {
  return [...buffer];
}
