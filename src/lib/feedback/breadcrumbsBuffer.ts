/**
 * Ring buffer global con los últimos N breadcrumbs (clicks, navegación,
 * fetch, errores). Idéntico patrón a consoleBuffer: se instala una sola
 * vez desde main.tsx y se lee al enviar un reporte de feedback.
 *
 * No persiste a localStorage. Filtra signed URLs y tokens.
 */
import { finder } from "@medv/finder";

const MAX = 50;

export interface Breadcrumb {
  ts: string; // HH:mm:ss.mmm
  category: "click" | "nav" | "fetch" | "xhr" | "error";
  message: string;
  data?: Record<string, string | number>;
}

const buffer: Breadcrumb[] = [];
let installed = false;

function push(b: Breadcrumb): void {
  try {
    buffer.push(b);
    if (buffer.length > MAX) buffer.shift();
  } catch {
    /* swallow */
  }
}

function now(): string {
  return new Date().toISOString().slice(11, 23);
}

function truncate(s: string, n = 120): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function sanitizeUrl(input: string): string {
  try {
    const u = new URL(input, window.location.origin);
    // Eliminar query strings sensibles
    const sensitiveKeys = ["access_token", "token", "apikey", "key", "signature", "Signature"];
    sensitiveKeys.forEach((k) => {
      if (u.searchParams.has(k)) u.searchParams.set(k, "***");
    });
    // Para signed URLs de Supabase Storage devolver sólo el path
    if (u.pathname.includes("/storage/v1/object/sign/")) {
      return u.pathname;
    }
    return `${u.pathname}${u.search}`;
  } catch {
    return input.split("?")[0];
  }
}

function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  const aria = el.getAttribute("aria-label");
  const label = aria ?? (text ? truncate(text, 40) : "");
  return label ? `${tag} "${label}"` : tag;
}

function safeSelector(el: Element): string | undefined {
  try {
    return finder(el as HTMLElement, {
      seedMinLength: 1,
      optimizedMinLength: 2,
      threshold: 400,
      timeoutMs: 80,
    });
  } catch {
    return undefined;
  }
}

function installClicks(): void {
  document.addEventListener(
    "click",
    (ev) => {
      const target = ev.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      // Ignorar clicks dentro del propio modal/picker para no inflar
      if (target.closest("[data-feedback-modal]") || target.closest("#feedback-picker-overlay")) {
        return;
      }
      const sel = safeSelector(target);
      push({
        ts: now(),
        category: "click",
        message: elementLabel(target),
        data: sel ? { selector: truncate(sel, 200) } : undefined,
      });
    },
    true,
  );
}

function installNav(): void {
  let last = window.location.pathname + window.location.search;
  const record = (from: string, to: string) => {
    if (from === to) return;
    push({ ts: now(), category: "nav", message: `${from} → ${to}` });
    last = to;
  };
  const wrap = (key: "pushState" | "replaceState") => {
    const orig = history[key].bind(history);
    history[key] = function (data: unknown, unused: string, url?: string | URL | null) {
      const from = last;
      const ret = orig(data as never, unused, url as never);
      const to = window.location.pathname + window.location.search;
      record(from, to);
      return ret;
    } as typeof history.pushState;
  };
  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", () => {
    record(last, window.location.pathname + window.location.search);
  });
}

function installFetch(): void {
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = sanitizeUrl(rawUrl);
    try {
      const res = await orig(input, init);
      push({
        ts: now(),
        category: "fetch",
        message: `${method} ${truncate(url, 140)} · ${res.status} · ${Math.round(performance.now() - started)}ms`,
      });
      return res;
    } catch (e) {
      push({
        ts: now(),
        category: "fetch",
        message: `${method} ${truncate(url, 140)} · ERROR · ${Math.round(performance.now() - started)}ms`,
        data: { error: truncate(String((e as Error)?.message ?? e), 120) },
      });
      throw e;
    }
  };
}

function installXhr(): void {
  type XhrMeta = { method: string; url: string; started: number };
  const meta = new WeakMap<XMLHttpRequest, XhrMeta>();
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    password?: string | null,
  ) {
    meta.set(this, {
      method: method.toUpperCase(),
      url: sanitizeUrl(String(url)),
      started: 0,
    });
    return origOpen.call(this, method, url, async ?? true, user, password);
  };
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const m = meta.get(this);
    if (m) {
      m.started = performance.now();
      this.addEventListener("loadend", () => {
        push({
          ts: now(),
          category: "xhr",
          message: `${m.method} ${truncate(m.url, 140)} · ${this.status} · ${Math.round(performance.now() - m.started)}ms`,
        });
      });
    }
    return origSend.call(this, body);
  };
}

function installErrors(): void {
  window.addEventListener("error", (e) => {
    const stackFirst = (e.error?.stack ?? "").split("\n")[1]?.trim();
    push({
      ts: now(),
      category: "error",
      message: truncate(e.message ?? "Error", 200),
      data: stackFirst ? { at: truncate(stackFirst, 160) } : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const msg =
      reason instanceof Error ? `${reason.name}: ${reason.message}` : `unhandled: ${String(reason)}`;
    push({ ts: now(), category: "error", message: truncate(msg, 200) });
  });
}

export function installBreadcrumbsBuffer(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try { installClicks(); } catch { /* noop */ }
  try { installNav(); } catch { /* noop */ }
  try { installFetch(); } catch { /* noop */ }
  try { installXhr(); } catch { /* noop */ }
  try { installErrors(); } catch { /* noop */ }
}

export function getBreadcrumbsSnapshot(): Breadcrumb[] {
  return [...buffer];
}
