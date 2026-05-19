/**
 * Genera un selector CSS único y razonablemente estable para un elemento.
 * Preferencias: [data-testid] > #id > path acotado con :nth-of-type.
 */
export function buildSelector(el: Element | null): string {
  if (!el) return "";
  const testid = el.getAttribute("data-testid");
  if (testid) return `[data-testid="${cssEscape(testid)}"]`;
  if (el.id) return `#${cssEscape(el.id)}`;

  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.nodeType === 1 && depth < 6 && cur !== document.body) {
    const tag = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    if (!parent) { parts.unshift(tag); break; }
    const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
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
  // CSS.escape polyfill mínimo
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(s);
  return s.replace(/([^\w-])/g, "\\$1");
}

export function elementText(el: Element | null): string {
  if (!el) return "";
  const text = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return text.trim().replace(/\s+/g, " ").slice(0, 200);
}
