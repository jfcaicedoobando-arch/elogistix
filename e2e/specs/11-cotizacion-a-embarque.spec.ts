/**
 * Flujo 11 — Cotización aceptada → convertir a embarque borrador.
 *
 * Requiere E2E_COTIZACION_ACEPTADA_ID (UUID de una cotización en estado
 * `aceptada` sin embarque vinculado). El spec marca el embarque resultante
 * con un tag en notas para identificación posterior; intenta borrarlo en
 * el cleanup (best-effort) vía RPC si existe.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const COTIZACION_ID = process.env.E2E_COTIZACION_ACEPTADA_ID ?? "";

test.describe("Flujo 11 — Cotización → embarque", () => {
  requireFixture(Boolean(COTIZACION_ID), "E2E_COTIZACION_ACEPTADA_ID requerido");

  let nuevoEmbarqueId: string | null = null;

  test.afterEach(async ({ page }, testInfo) => {
    if (!nuevoEmbarqueId) return;
    const id = nuevoEmbarqueId;
    // Borrar en orden FK-safe: hijos primero, luego el embarque.
    await bestEffortCleanup(testInfo, "borrar tracking_eventos", async () => {
      await supabaseRest(page).delete("eventos_embarque", { embarque_id: id });
    });
    await bestEffortCleanup(testInfo, "borrar embarque_contenedores", async () => {
      await supabaseRest(page).delete("embarque_contenedores", { embarque_id: id });
    });
    await bestEffortCleanup(testInfo, "borrar conceptos_costo", async () => {
      await supabaseRest(page).delete("conceptos_costo", { embarque_id: id });
    });
    await bestEffortCleanup(testInfo, "borrar conceptos_venta", async () => {
      await supabaseRest(page).delete("conceptos_venta", { embarque_id: id });
    });
    await bestEffortCleanup(testInfo, "borrar embarque borrador E2E", async () => {
      await supabaseRest(page).delete("embarques", { id });
    });
    nuevoEmbarqueId = null;
  });

  test("convierte cotización aceptada en embarque borrador", async ({ page }, testInfo) => {
    await loginAs(page, internalCreds());
    await page.goto(`/cotizaciones/${COTIZACION_ID}`);

    await expect(page.getByText(/aceptad/i).first()).toBeVisible({ timeout: 15_000 });

    const btnConvertir = page
      .getByRole("button", { name: /convertir.*embarque|crear embarque/i })
      .first();
    await expect(btnConvertir).toBeVisible({ timeout: 10_000 });
    await btnConvertir.click();

    // Confirmación del diálogo.
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: /confirmar|convertir|crear/i }).click();
    }

    const rpcResp = await page.waitForResponse(
      (r) =>
        /\/rpc\/crear_embarque_borrador_desde_cotizacion/i.test(r.url()) && r.ok(),
      { timeout: 20_000 },
    );
    const body = (await rpcResp.json().catch(() => null)) as
      | { id?: string }
      | string
      | null;
    if (typeof body === "string") nuevoEmbarqueId = body;
    else if (body && typeof body === "object" && typeof body.id === "string")
      nuevoEmbarqueId = body.id;

    // Redirección al nuevo embarque.
    await page.waitForURL(/\/embarques\/[0-9a-f-]{36}/i, { timeout: 15_000 });
    const urlId = page.url().match(/\/embarques\/([0-9a-f-]{36})/i)?.[1] ?? null;
    nuevoEmbarqueId = nuevoEmbarqueId ?? urlId;
    expect(nuevoEmbarqueId, "no se pudo capturar id del nuevo embarque").toBeTruthy();

    // Marcar el embarque con tag E2E_TEST para localizarlo en reportes de basura
    // si el cleanup falla. Best-effort: no rompemos el test si la columna está bloqueada.
    if (nuevoEmbarqueId) {
      await bestEffortCleanup(testInfo, "tag E2E_TEST en notas_internas", async () => {
        await supabaseRest(page).patch(
          "embarques",
          { id: nuevoEmbarqueId! },
          { notas_internas: "E2E_TEST — cotización→embarque" },
        );
      });
    }

    // Heading con expediente real.
    await expect(
      page.getByRole("heading", { name: /EL(IMP|EXP|GEN)\d+/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
