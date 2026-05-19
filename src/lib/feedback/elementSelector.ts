/**
 * Selector + traversal helpers para el picker de feedback.
 */

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
 * Genera un selector CSS único y razonablemente estable.
 * Preferencias: [data-testid] > #id > [aria-label] > path acotado con :nth-of-type.
 */
export function buildSelector(el: Element | null): string {
  if (!el) return "";
  const testid = el.getAttribute("data-testid");
  if (testid) return `[data-testid="${cssEscape(testid)}"]`;
  if (el.id) return `#${cssEscape(el.id)}`;
  const aria = el.getAttribute("aria-label");
  if (aria) return `${el.tagName.toLowerCase()}[aria-label="${cssEscape(aria)}"]`;

  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 6 && cur !== document.body) {
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) { parts.unshift(tag); break; }
    const tagName = cur.tagName;
    const sameTag = Array.from(parent.children).filter((c: Element) => c.tagName === tagName);
    if (sameTag.length === 1) parts.unshift(tag);
    else {
      const idx = sameTag.indexOf(cur) + 1;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
    }
    cur = parent;
    depth++;
  }
  return parts.join(" > ").slice(0, 300);
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(s);
  return s.replace(/([^\w-])/g, "\\$1");
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
