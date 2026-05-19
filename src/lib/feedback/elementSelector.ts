/**
 * Selector + traversal helpers para el picker de feedback.
 */
import { finder } from "@medv/finder";


const MEANINGFUL_TAGS = new Set([
  "BUTTON", "A", "TR", "LI", "LABEL", "INPUT", "SELECT", "TEXTAREA",
  "TABLE", "FORM", "NAV", "HEADER", "FOOTER", "ARTICLE", "DIALOG",
]);

function isMeaningful(el: Element): boolean {
  if (el.hasAttribute("data-testid")) return true;
  if (el.hasAttribute("data-feedback-target")) return true;
  if (el.hasAttribute("aria-label")) return true;
  if (el.getAttribute("role") === "button") return true;
  if (MEANINGFUL_TAGS.has(el.tagName)) return true;
  return false;
}

/**
 * Sube por el DOM hasta encontrar un "componente útil" para reportar.
 * Tope: 6 niveles o cuando el rect ocupe >80% del viewport.
 */
export function pickMeaningfulAncestor(el: Element | null): Element | null {
  if (!el) return null;
  if (el === document.body || el === document.documentElement) return el;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cur: Element | null = el;
  let depth = 0;

  while (cur && cur !== document.body && depth < 6) {
    if (isMeaningful(cur)) return cur;
    const r = cur.getBoundingClientRect();
    if (r.width > vw * 0.8 && r.height > vh * 0.8) return cur;
    cur = cur.parentElement;
    depth++;
  }
  return el;
}

/**
 * Genera un selector CSS único y estable usando @medv/finder.
 * finder prioriza id, data-testid, aria-label y clases estables;
 * sólo cae a :nth-child cuando no hay otra opción.
 */
export function buildSelector(el: Element | null): string {
  if (!el) return "";
  try {
    return finder(el as HTMLElement, {
      seedMinLength: 1,
      optimizedMinLength: 2,
      threshold: 800,
      timeoutMs: 200,
    });
  } catch {
    // Fallback minimal si finder no logra resolver (ej. nodos huérfanos)
    const tag = el.tagName.toLowerCase();
    return el.id ? `#${el.id}` : tag;
  }
}

export function elementText(el: Element | null): string {
  if (!el) return "";
  const text = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return text.trim().replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Etiqueta corta tipo "button.primary" para el badge flotante.
 */
export function shortLabel(el: Element | null): string {
  if (!el) return "";
  const tag = el.tagName.toLowerCase();
  const testid = el.getAttribute("data-testid");
  if (testid) return `${tag}[${testid}]`;
  const aria = el.getAttribute("aria-label");
  if (aria) return `${tag}[${aria.slice(0, 24)}]`;
  const cls = (el.getAttribute("class") || "")
    .split(/\s+/)
    .filter((c) => c && !c.startsWith("hover:") && !c.startsWith("focus:") && !c.includes(":"))
    .slice(0, 1)
    .join("");
  return cls ? `${tag}.${cls}` : tag;
}
