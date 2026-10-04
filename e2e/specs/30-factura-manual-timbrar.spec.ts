/** Error fiscal simulado: nunca contactar el PAC ni seleccionar otra factura. */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const FACTURA_ID = process.env.E2E_FACTURA_BORRADOR_ID ?? "";
const CAUSA = "El receptor no tiene régimen fiscal válido";

test.describe("Flujo 30 — Borrador propio: rechazo del PAC simulado", () => {
  test("intenta timbrar exactamente el borrador indicado y presenta la causa", {
    annotation: { type: "allow-console", description: "Failed to load resource:.*400|El receptor no tiene régimen fiscal válido" },
  }, async ({ page }) => {
    requireFixture(Boolean(FACTURA_ID), "E2E_FACTURA_BORRADOR_ID requerido (borrador mock completo)");
    const errors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));
    const intercepted: string[] = [];
    await page.route("**/functions/v1/facturapi-**", async route => {
      expect(new URL(route.request().url()).pathname).toBe("/functions/v1/facturapi-emitir");
      const body = route.request().postDataJSON() as { factura_id: string };
      expect(body.factura_id).toBe(FACTURA_ID);
      intercepted.push(body.factura_id);
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: CAUSA }) });
    });
    await loginAs(page, internalCreds());
    const rest = supabaseRest(page);
    const before = await rest.select("facturas", { id: FACTURA_ID, deleted_at: "is.null" }, "id,estado,uuid_fiscal,facturapi_id");
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ id: FACTURA_ID, estado: "Borrador", uuid_fiscal: null, facturapi_id: null });
    await page.goto("/facturacion/" + FACTURA_ID);
    const timbrar = page.getByRole("button", { name: "Timbrar factura", exact: true });
    await expect(timbrar).toBeVisible();
    await timbrar.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Timbrar ahora", exact: true });
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText(CAUSA, { exact: true }).first()).toBeVisible();
    expect(intercepted).toEqual([FACTURA_ID]);
    expect(errors.filter(error => /reading '(slice|uuid_fiscal|serie|folio)'/i.test(error))).toEqual([]);
    const after = await rest.select("facturas", { id: FACTURA_ID }, "estado,uuid_fiscal,facturapi_id");
    expect(after[0]).toMatchObject({ estado: "Borrador", uuid_fiscal: null, facturapi_id: null });
  });

  test("factura inexistente muestra un resultado concreto, no skeleton infinito", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/facturacion/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Factura no encontrada", { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("link", { name: "Volver a Facturación" })).toBeVisible();
  });
});
