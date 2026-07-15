/**
 * `testBase.ts` — fixture canónico para specs E2E.
 *
 * v13.300.28 — Aislamiento de sesión entre specs.
 *
 * Extiende el `test` base de Playwright con dos fixtures auto:
 *
 *   1) `autoPageErrors` — captura `pageerror` y `console.error` no
 *      whitelisteados y falla el test al final (idem `pageErrors.ts`).
 *
 *   2) `sessionIsolation` — evita contaminación de cookies/tokens entre
 *      specs y entre roles (admin ↔ portal cliente):
 *        - beforeEach: verifica que el `storageState` cargado corresponde
 *          al `baseURL` esperado; loguea aviso si detecta cookies u
 *          orígenes ajenos filtrados en el estado inicial.
 *        - afterEach: `context.clearCookies()` + `localStorage.clear()` +
 *          `sessionStorage.clear()` sobre el origen actual. Es defensivo
 *          porque Playwright ya crea un `BrowserContext` fresco por test
 *          desde `use.storageState`, pero blinda el escenario donde un
 *          spec navega a otro rol / origen dentro del mismo test (ver
 *          `switchUser` en `auth.ts`).
 *
 * Reglas de uso:
 *   - Todos los specs importan `{ expect, test }` desde este archivo.
 *   - Para mezclar roles dentro de un mismo test usar `switchUser(page, creds)`
 *     que hace el reset completo antes del `loginAs`.
 */
import { test as base, expect } from "@playwright/test";

// Ruidos conocidos que NO indican un bug funcional (extensiones, telemetría).
const DEFAULT_ALLOWLIST: RegExp[] = [
  /ResizeObserver loop/i,
  /Non-Error promise rejection captured/i,
  /Failed to load resource.*sentry/i,
  /circular structure/i,
];

interface Fixtures {
  autoPageErrors: void;
  sessionIsolation: void;
}

export const test = base.extend<Fixtures>({
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
        if (testInfo.status === "passed" || testInfo.status === undefined) {
          throw new Error(
            `Errores de página no esperados (${errors.length}):\n${errors.join("\n")}`,
          );
        }
      }
    },
    { auto: true },
  ],

  sessionIsolation: [
    async ({ context, baseURL }, use, testInfo) => {
      // Sanity check: reportar (no fallar) cookies de dominios distintos al
      // baseURL que hubieran quedado en el storageState del project.
      try {
        const cookies = await context.cookies();
        const expectedHost = baseURL ? new URL(baseURL).hostname : null;
        if (expectedHost) {
          const foreign = cookies.filter(
            (c) => c.domain && !c.domain.replace(/^\./, "").endsWith(expectedHost),
          );
          if (foreign.length > 0) {
            await testInfo.attach("session-foreign-cookies.txt", {
              body: foreign.map((c) => `${c.domain} ${c.name}`).join("\n"),
              contentType: "text/plain",
            });
          }
        }
      } catch {
        // Ignorar — es diagnóstico best-effort.
      }

      await use();

      // Limpieza defensiva: aunque Playwright destruya el contexto al final
      // del test, si el spec quedó en medio de un flujo con tokens de otro
      // rol garantizamos que no persista nada al reporte/traza.
      try {
        await context.clearCookies();
        for (const p of context.pages()) {
          if (p.isClosed()) continue;
          await p
            .evaluate(() => {
              try {
                window.localStorage.clear();
                window.sessionStorage.clear();
              } catch {
                /* origen restringido */
              }
            })
            .catch(() => undefined);
        }
      } catch {
        /* contexto ya cerrado */
      }
    },
    { auto: true },
  ],
});

export { expect };
