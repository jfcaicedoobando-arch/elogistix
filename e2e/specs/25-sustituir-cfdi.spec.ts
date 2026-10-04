/** Sustitución sandbox: persistencia y auto-reset ANTES de cancelar el original. */
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";
import { attachFiscalRecords, requireSandbox } from "../fixtures/fiscal";

const FACTURA_ID = process.env.E2E_SUSTITUCION_FACTURA_UUID ?? "";
const storageKey = "sustitucion:" + FACTURA_ID;

async function abrir(page: Page) {
  await page.goto("/facturacion/" + FACTURA_ID);
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sustituir CFDI", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function duplicar(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith("/rpc/duplicar_factura_para_sustitucion") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Crear borrador y continuar", exact: true }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  const id = await result.json() as string;
  expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page).toHaveURL(new RegExp("/facturacion/" + id));
  return id;
}

test.describe("Flujo 25 — Sustituir CFDI", () => {
  requireFixture(process.env.E2E_FISCAL === "1" && Boolean(FACTURA_ID), "E2E_FISCAL=1 + E2E_SUSTITUCION_FACTURA_UUID (original sandbox nuevo por ejecución)");

  test("restaura en la misma pestaña, elimina sólo su borrador y sustituye el CFDI", async ({ page }, info) => {
    test.setTimeout(150_000);
    await loginAs(page, internalCreds());
    const rest = supabaseRest(page);
    const originals = await rest.select("facturas", { id: FACTURA_ID, deleted_at: "is.null" }, "id,organization_id,estado,uuid_fiscal");
    expect(originals).toHaveLength(1);
    expect(originals[0].estado).toBe("Emitida");
    expect(originals[0].uuid_fiscal).toBeTruthy();
    await requireSandbox(page, String(originals[0].organization_id));
    await abrir(page);
    const discardedDraft = await duplicar(page);
    await attachFiscalRecords(info, { originalId: FACTURA_ID, discardedDraft });

    // Reabrir y recargar en la MISMA Page conserva su sessionStorage real.
    await abrir(page);
    await expect(page.getByRole("button", { name: "Cancelar original", exact: true })).toBeDisabled();
    expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), storageKey))!)).toMatchObject({ nuevaId: discardedDraft });
    await page.reload();
    await page.getByRole("button", { name: "Más acciones", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sustituir CFDI", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cancelar original", exact: true })).toBeDisabled();

    // La operación canónica sólo da de baja EL borrador recién creado.
    await rest.rpc("eliminar_factura_borrador", { p_factura_id: discardedDraft });
    await abrir(page);
    await expect(page.getByRole("button", { name: "Crear borrador y continuar", exact: true })).toBeVisible();
    expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
    expect(await rest.select("facturas", { id: discardedDraft, deleted_at: "is.null" }, "id")).toHaveLength(0);

    const replacementId = await duplicar(page);
    expect(replacementId).not.toBe(discardedDraft);
    await attachFiscalRecords(info, { originalId: FACTURA_ID, replacementId });
    await page.goto("/facturacion/" + replacementId);
    await page.getByRole("button", { name: "Timbrar factura", exact: true }).click();
    const emission = page.waitForResponse(r => r.url().endsWith("/functions/v1/facturapi-emitir"));
    await page.getByRole("dialog").getByRole("button", { name: "Timbrar ahora", exact: true }).click();
    const emitted = await emission;
    expect(emitted.request().postDataJSON().factura_id).toBe(replacementId);
    expect([200, 202]).toContain(emitted.status());
    await expect.poll(async () => (await rest.select("facturas", { id: replacementId }, "uuid_fiscal"))[0]?.uuid_fiscal, { timeout: 60_000 }).toBeTruthy();

    await abrir(page);
    const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancelar original", exact: true });
    await expect(cancel).toBeEnabled();
    const cancellation = page.waitForResponse(r => r.url().endsWith("/functions/v1/facturapi-cancelar"));
    await cancel.click();
    const cancelled = await cancellation;
    expect(cancelled.request().postDataJSON()).toMatchObject({ factura_id: FACTURA_ID, motivo: "01", sustituida_por_factura_id: replacementId });
    expect(cancelled.ok()).toBe(true);
    await expect.poll(async () => (await rest.select("facturas", { id: FACTURA_ID }, "estado"))[0]?.estado, { timeout: 45_000 }).toMatch(/Sustituida|En cancelaci[oó]n/);
    await attachFiscalRecords(info, { originalId: FACTURA_ID, replacement: await rest.select("facturas", { id: replacementId }, "id,uuid_fiscal") });
    // No cancelar/borrar la sustituta: se conserva trazabilidad fiscal sandbox.
  });
});
