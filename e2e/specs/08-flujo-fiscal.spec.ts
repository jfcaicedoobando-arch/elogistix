/** Proforma mock NUEVA → su factura → pago → REP. Conserva evidencia fiscal. */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";
import { attachFiscalRecords, requireSandbox } from "../fixtures/fiscal";

const PROFORMA = process.env.E2E_PROFORMA_NUMERO ?? "";

test.describe("Flujo 08 — Fiscal sandbox", () => {
  requireFixture(process.env.E2E_FISCAL === "1" && Boolean(PROFORMA), "E2E_FISCAL=1 + E2E_PROFORMA_NUMERO requeridos (proforma mock nueva por ejecución)");

  test("convierte, timbra y paga sólo la factura creada por este test", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await loginAs(page, internalCreds());
    const rest = supabaseRest(page);
    const proformas = await rest.select("proformas", { numero: PROFORMA, deleted_at: "is.null" }, "id,organization_id,estado_proforma");
    expect(proformas).toHaveLength(1);
    const proforma = proformas[0];
    await requireSandbox(page, String(proforma.organization_id));
    await page.goto("/facturacion");
    await page.getByRole("tab", { name: /por timbrar/i }).click();
    const row = page.getByRole("row").filter({ has: page.getByText(PROFORMA, { exact: true }) });
    await expect(row).toHaveCount(1);
    await row.getByRole("checkbox").check();
    const conversion = page.waitForResponse(r => /\/rpc\/convertir_proformas_a_factura$/.test(new URL(r.url()).pathname) && r.request().method() === "POST");
    await page.getByRole("button", { name: /convertir a factura/i }).click();
    const response = await conversion;
    expect(response.ok()).toBe(true);
    expect(response.request().postDataJSON().p_proforma_ids).toEqual([proforma.id]);
    const facturas = await response.json() as Array<{ id: string }>;
    expect(facturas, "semilla monomoneda para un CFDI único").toHaveLength(1);
    const facturaId = facturas[0].id;
    expect(facturaId).toMatch(/^[0-9a-f-]{36}$/i);
    await attachFiscalRecords(testInfo, { proformaId: proforma.id, facturaId });
    const own = await rest.select("facturas", { id: facturaId }, "id,metodo_pago,estado,total");
    expect(own[0]).toMatchObject({ id: facturaId, estado: "Borrador", metodo_pago: "PPD" });
    expect(Number(own[0].total), "pago parcial de 100 debe caber en el saldo").toBeGreaterThan(100);
    await page.goto("/facturacion/" + facturaId);
    await page.getByRole("button", { name: "Timbrar factura", exact: true }).click();
    const emission = page.waitForResponse(r => r.url().endsWith("/functions/v1/facturapi-emitir"));
    await page.getByRole("dialog").getByRole("button", { name: "Timbrar ahora", exact: true }).click();
    const emitted = await emission;
    expect(emitted.request().postDataJSON().factura_id).toBe(facturaId);
    expect([200, 202]).toContain(emitted.status());
    await expect.poll(async () => (await rest.select("facturas", { id: facturaId }, "uuid_fiscal"))[0]?.uuid_fiscal, { timeout: 45_000 }).toBeTruthy();
    await page.getByRole("button", { name: /registrar pago/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/monto/i).fill("100");
    await dialog.getByLabel(/forma de pago/i).click();
    await page.getByRole("option", { name: /efectivo/i }).click();
    await dialog.getByRole("button", { name: /guardar|registrar/i }).click();
    await expect.poll(async () => {
      const pagos = await rest.select("pagos_factura", { factura_id: facturaId, deleted_at: "is.null" }, "id,monto_aplicado_factura,estado_rep,uuid_rep");
      return pagos.length === 1 && Number(pagos[0].monto_aplicado_factura) === 100 && pagos[0].estado_rep === "Timbrado" && Boolean(pagos[0].uuid_rep);
    }, { timeout: 60_000 }).toBe(true);
    await attachFiscalRecords(testInfo, { facturaId, pagos: await rest.select("pagos_factura", { factura_id: facturaId }, "id,uuid_rep") });
  });
});

