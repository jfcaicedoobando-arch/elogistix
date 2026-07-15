/**
 * Fixture `test` extendido — captura page errors y errores de consola.
 *
 * Instala listeners globales `pageerror` y `console.error` en cada `page`.
 * Al final del test, si hubo errores no whitelisteados, falla con detalle.
 *
 * Whitelist por spec:
 *   test.info().annotations.push({ type: "allow-console", description: "regex source" });
 * Ver ejemplo en 24-auditoria-cache-invalidation.spec.ts.
 *
 * v13.300.23.
 */
import { test as base, expect } from "@playwright/test";

// Ruidos conocidos que NO indican un bug funcional (extensiones, telemetría).
const DEFAULT_ALLOWLIST: RegExp[] = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Failed to load resource.*sentry/i, // beacon Sentry en 4xx/5xx no rompe la app.
  /circular structure/i, // ver mem: extensiones inyectan objetos con ciclos.
];

interface PageErrorsFixtures {
  autoPageErrors: void;
}

export const test = base.extend<PageErrorsFixtures>({
  autoPageErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];

      const extraAllow: RegExp[] = testInfo.annotations
        .filter((a) => a.type === "allow-console" && a.description)
        .map((a) => new RegExp(a.description as string, "i"));

      const isAllowed = (msg: string): boolean =>
        DEFAULT_ALLOWLIST.some((re) => re.test(msg)) ||
        extraAllow.some((re) => re.test(msg));

      const onPageError = (err: Error): void => {
        const msg = `[pageerror] ${err.message}`;
        if (!isAllowed(msg)) errors.push(msg);
      };
      const onConsole = (m: import("@playwright/test").ConsoleMessage): void => {
        if (m.type() !== "error") return;
        const msg = `[console.error] ${m.text().slice(0, 500)}`;
        if (!isAllowed(msg)) errors.push(msg);
      };

      page.on("pageerror", onPageError);
      page.on("console", onConsole);

      await use();

      page.off("pageerror", onPageError);
      page.off("console", onConsole);

      if (errors.length > 0) {
        await testInfo.attach("page-errors.txt", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
        // Falla el test — solo si el test principal ya pasó, para no
        // enmascarar la causa real; si el test ya falló, agregar contexto.
        if (testInfo.status === "passed" || testInfo.status === undefined) {
          throw new Error(
            `Errores de página no esperados (${errors.length}):\n${errors.join("\n")}`,
          );
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
