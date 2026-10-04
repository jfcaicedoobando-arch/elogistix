import type { Page } from "@playwright/test";

/** Observa el autoguardado real; no sustituye el debounce por una espera fija. */
export async function draftValue(page: Page, field: string): Promise<unknown> {
  return page.evaluate(name => {
    const drafts = Object.keys(localStorage).filter(key => key.startsWith("lc:cotizacion:draft:"));
    if (drafts.length !== 1) return null;
    const draft = JSON.parse(localStorage.getItem(drafts[0]) ?? "null");
    return draft?.values?.[name] ?? null;
  }, field);
}
