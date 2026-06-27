/**
 * Helpers de cleanup best-effort para specs E2E mutadores.
 *
 * Política: si el cleanup falla NO debe romper el spec — el assert principal
 * ya pasó. Se adjunta el warning al `testInfo` (si se provee) para que aparezca
 * en el reporte HTML; fallback a `console.warn`.
 */
import type { TestInfo } from "@playwright/test";

export async function bestEffortCleanup(
  labelOrInfo: string | TestInfo,
  fnOrLabel: (() => Promise<unknown>) | string,
  maybeFn?: () => Promise<unknown>,
): Promise<void> {
  // Sobrecarga: bestEffortCleanup(label, fn) | bestEffortCleanup(testInfo, label, fn).
  let info: TestInfo | null = null;
  let label: string;
  let fn: () => Promise<unknown>;
  if (typeof labelOrInfo === "string") {
    label = labelOrInfo;
    fn = fnOrLabel as () => Promise<unknown>;
  } else {
    info = labelOrInfo;
    label = fnOrLabel as string;
    fn = maybeFn as () => Promise<unknown>;
  }

  try {
    await fn();
  } catch (err) {
    const msg = `[e2e cleanup] '${label}' falló: ${(err as Error).message}`;
    if (info) {
      await info
        .attach(`cleanup-warning-${label.replace(/\s+/g, "_")}`, {
          body: msg,
          contentType: "text/plain",
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
}
