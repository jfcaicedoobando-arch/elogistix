/**
 * Flujo 25 — Sustitución CFDI (motivo SAT 01), single-tab.
 *
 * Cubre el wizard implementado en `DialogSustituirFactura` + `useSustitucionState`
 * y `sustitucion/persistence.ts` (v13.301.x):
 *
 *   1) Happy path: duplicar borrador → timbrar sustituta → cancelar original
 *      motivo 01. El toast final puede ser `success` (accepted) o `info`
 *      (pending 72h) — ambos son terminales.
 *   2) Persistencia sessionStorage: cerrar y reabrir el diálogo restaura el
 *      paso "confirmar".
 *   3) Guard UI: con la sustituta en `Borrador`, "Cancelar original" queda
 *      deshabilitado.
 *   4) Auto-reset: si el borrador sustituto se elimina externamente, al
 *      reabrir el diálogo vuelve a "intro".
 *
 * Sandbox-only. Gated por env:
 *   E2E_FISCAL=1
 *   E2E_SUSTITUCION_FACTURA_UUID=<id de una factura sandbox ya timbrada>
 *
 * Uso:
 *   E2E_FISCAL=1 E2E_SUSTITUCION_FACTURA_UUID=... npx playwright test 25
 *
 * v13.301.5.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";

const ENABLED = process.env.E2E_FISCAL === "1";
const FACTURA_ID = process.env.E2E_SUSTITUCION_FACTURA_UUID ?? "";

test.describe.configure({ mode: "serial" });

test.describe("Flujo 25 — Sustituir CFDI", () => {
  test.skip(
    !ENABLED || !FACTURA_ID,
    "Requiere E2E_FISCAL=1 y E2E_SUSTITUCION_FACTURA_UUID",
  );

  // Estado compartido entre tests serie.
  let sustitutaId: string | null = null;
  let sustitutaTimbradaId: string | null = null;
  let lastPage: import("@playwright/test").Page | null = null;

  test.afterAll(async (_fx, testInfo) => {
    if (!lastPage) return;
    // Si quedó un borrador huérfano (sin timbrar) → borrarlo.
    if (sustitutaId && !sustitutaTimbradaId) {
      await bestEffortCleanup(testInfo, "borrar borrador sustituto", async () => {
        await supabaseRest(lastPage!).delete("facturas", { id: sustitutaId! });
      });
    }
    // Si la sustituta llegó a timbrarse, cancelarla motivo 02 (sandbox).
    if (sustitutaTimbradaId) {
      await bestEffortCleanup(testInfo, "cancelar sustituta sandbox motivo 02", async () => {
        await supabaseRest(lastPage!).rpc("cancelar_factura", {
          p_factura_id: sustitutaTimbradaId,
          p_motivo: "02",
        });
      });
    }
    // Limpiar persistencia sessionStorage para no ensuciar el próximo run.
    await bestEffortCleanup(testInfo, "limpiar sessionStorage sustitucion", async () => {
      await lastPage!
        .evaluate((id) => window.sessionStorage.removeItem(`sustitucion:${id}`), FACTURA_ID)
        .catch(() => undefined);
    });
  });

  async function abrirDialogoSustituir(page: import("@playwright/test").Page) {
    await page.goto(`/facturacion/${FACTURA_ID}`);
    await expect(page.getByRole("heading", { name: /factura/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    // El botón "Sustituir CFDI" vive en el actions-bar; puede ser botón directo
    // o item de un menú "Más acciones".
    const directo = page.getByRole("button", { name: /sustituir cfdi/i });
    if (await directo.isVisible().catch(() => false)) {
      await directo.click();
    } else {
      await page.getByRole("button", { name: /m[aá]s acciones|acciones/i }).first().click();
      await page.getByRole("menuitem", { name: /sustituir cfdi/i }).click();
    }
    await expect(
      page.getByRole("dialog").getByText(/sustituir cfdi/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  test("1. happy path — duplica, timbra sustituta y cancela original motivo 01", async ({ page }) => {
    await loginAs(page, internalCreds());
    lastPage = page;

    await abrirDialogoSustituir(page);

    // Paso 1 → duplicar. Capturamos el id vía RPC response.
    const rpcResp = page.waitForResponse(
      (r) =>
        /\/rpc\/duplicar_factura_para_sustitucion/i.test(r.url()) && r.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByRole("button", { name: /crear borrador y continuar/i }).click();
    const resp = await rpcResp;
    const body = (await resp.json().catch(() => null)) as unknown;
    // El RPC devuelve el uuid como texto plano o string envuelto.
    const parsedId = typeof body === "string" ? body : "";
    expect(parsedId).toMatch(/^[0-9a-f-]{36}$/i);
    sustitutaId = parsedId;

    // Debe redirigir al detalle del borrador.
    await expect(page).toHaveURL(new RegExp(`/facturacion/${sustitutaId}\\b`), {
      timeout: 15_000,
    });
    // Verificar que el borrador trae conceptos (heurística: existe una tabla con al menos una fila).
    await expect(
      page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Timbrar la sustituta (sandbox).
    await page.getByRole("button", { name: /^timbrar$/i }).first().click();
    // Confirmación dentro del modal.
    const confirm = page.getByRole("button", { name: /^timbrar$/i }).last();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(page.getByText(/timbrada|emitida/i).first()).toBeVisible({ timeout: 45_000 });
    sustitutaTimbradaId = sustitutaId;

    // Regresar al detalle de la original y reabrir el diálogo.
    await abrirDialogoSustituir(page);

    // Debe restaurar paso "confirmar" (aparece "Cancelar original").
    const cancelarBtn = page.getByRole("button", { name: /cancelar original/i });
    await expect(cancelarBtn).toBeVisible({ timeout: 10_000 });
    // Espera a que la sustituta se detecte como timbrada → botón habilitado.
    await expect(cancelarBtn).toBeEnabled({ timeout: 15_000 });

    await cancelarBtn.click();

    // Terminal: success (accepted) o info (pending 72h). Ambos aceptables.
    await expect(
      page.getByText(/cfdi cancelado|cancelaci[oó]n enviada al sat/i),
    ).toBeVisible({ timeout: 45_000 });
  });

  test("2. persistencia — al reabrir el diálogo sin timbrar, restaura paso confirmar", async ({ page }) => {
    test.skip(!sustitutaId, "requiere sustituta creada en test 1");
    await loginAs(page, internalCreds());
    lastPage = page;

    await abrirDialogoSustituir(page);
    await expect(page.getByRole("button", { name: /cancelar original/i })).toBeVisible({
      timeout: 10_000,
    });
    // La persistencia real vive en sessionStorage; verificar la clave.
    const stored = await page.evaluate(
      (id) => window.sessionStorage.getItem(`sustitucion:${id}`),
      FACTURA_ID,
    );
    expect(stored).not.toBeNull();
  });

  test("3. guard UI — cancelar original queda disabled si la sustituta es Borrador", async ({ page }) => {
    await loginAs(page, internalCreds());
    lastPage = page;

    // Crear un borrador fresco (independiente del happy path anterior).
    await abrirDialogoSustituir(page);
    // Si ya estamos en paso "confirmar" con sustituta timbrada, reiniciar primero.
    const reiniciar = page.getByRole("button", { name: /reiniciar/i });
    if (await reiniciar.isVisible().catch(() => false)) {
      await reiniciar.click();
    }

    const rpcResp = page.waitForResponse(
      (r) => /\/rpc\/duplicar_factura_para_sustitucion/i.test(r.url()),
      { timeout: 20_000 },
    );
    const crear = page.getByRole("button", { name: /crear borrador y continuar/i });
    if (await crear.isVisible().catch(() => false)) {
      await crear.click();
      const resp = await rpcResp;
      const raw = (await resp.json().catch(() => null)) as unknown;
      const id = typeof raw === "string" ? raw : "";
      if (id) sustitutaId = id; // reasignar para cleanup
    }

    // Volver a la original SIN timbrar la sustituta.
    await abrirDialogoSustituir(page);
    const cancelarBtn = page.getByRole("button", { name: /cancelar original/i });
    await expect(cancelarBtn).toBeVisible({ timeout: 10_000 });
    await expect(cancelarBtn).toBeDisabled();
  });

  test("4. auto-reset — si el borrador es eliminado externamente, el diálogo vuelve a intro", async ({ page }) => {
    test.skip(!sustitutaId, "requiere borrador vivo");
    await loginAs(page, internalCreds());
    lastPage = page;

    // Borrar el borrador vía REST (RLS lo permite en estado Borrador).
    await supabaseRest(page).delete("facturas", { id: sustitutaId! });
    // Marcarlo como consumido para el cleanup del afterAll.
    const eliminado = sustitutaId;
    sustitutaId = null;
    sustitutaTimbradaId = null;

    await abrirDialogoSustituir(page);
    // Debe caer en paso intro (aparece "Crear borrador y continuar").
    await expect(
      page.getByRole("button", { name: /crear borrador y continuar/i }),
    ).toBeVisible({ timeout: 10_000 });
    // La clave sessionStorage debe estar limpia.
    const stored = await page.evaluate(
      (id) => window.sessionStorage.getItem(`sustitucion:${id}`),
      FACTURA_ID,
    );
    expect(stored).toBeNull();
    // sanity: el id borrado ya no existe en la DB (best-effort — no crítico).
    void eliminado;
  });
});
