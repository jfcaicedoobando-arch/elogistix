/**
 * Flujo 12 — CXP: capturar factura de proveedor + registrar pago.
 *
 * Requiere:
 *   E2E_PROVEEDOR_ID            — UUID del proveedor.
 *   E2E_EMBARQUE_PARA_CXP_ID    — UUID de un embarque abierto donde imputar.
 *
 * Cleanup best-effort: borra el pago y luego la factura insertados.
 *
 * v13.x — folio interno FP-XXXXXX por org.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const PROVEEDOR_ID = process.env.E2E_PROVEEDOR_ID ?? "";
const EMBARQUE_ID = process.env.E2E_EMBARQUE_PARA_CXP_ID ?? "";

test.describe.configure({ mode: "serial" });

test.describe("Flujo 12 — CXP captura + pago", () => {
  requireFixture(
    Boolean(PROVEEDOR_ID) && Boolean(EMBARQUE_ID),
    "E2E_PROVEEDOR_ID y E2E_EMBARQUE_PARA_CXP_ID requeridos",
  );

  let facturaId: string | null = null;
  let folio: string | null = null;

  test.afterAll(async ({ browser }, testInfo) => {
    if (!facturaId) return;
    // Intento 1: usar storageState directo. Si el token expiró o el setup
    // falló, caemos a loginAs() vía formulario en el mismo context.
    const ctx = await browser.newContext({ storageState: "e2e/.auth/internal.json" });
    const page = await ctx.newPage();
    try {
      await page.goto("/");
      // Probar el handle; si falla, login UI para mintear sesión fresca.
      await page.waitForLoadState("domcontentloaded");
      const hasSession = await page.evaluate(() =>
        Object.keys(window.localStorage).some((k) => /^sb-[^-]+-auth-token$/.test(k)),
      );
      if (!hasSession) {
        await loginAs(page, internalCreds());
      }
      await bestEffortCleanup(testInfo, "borrar pagos del proveedor", async () => {
        await supabaseRest(page).delete("pagos_proveedor", { proveedor_factura_id: facturaId! });
      });
      await bestEffortCleanup(testInfo, "borrar factura proveedor E2E", async () => {
        await supabaseRest(page).delete("proveedor_facturas", { id: facturaId! });
      });
      // Red de seguridad: borra cualquier otra factura tagueada E2E_TEST
      // del mismo proveedor (capa por si quedaron facturas de runs previos).
      await bestEffortCleanup(testInfo, "barrido defensivo E2E_TEST", async () => {
        await supabaseRest(page).delete("proveedor_facturas", {
          referencia: "like.*E2E_TEST*",
          proveedor_id: PROVEEDOR_ID,
        });
      });
    } finally {
      await ctx.close();
    }
  });

  test("captura factura proveedor y asigna folio FP-XXXXXX", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/compras/por-capturar");

    await expect(
      page.getByRole("heading", { name: /por capturar|compras/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /nueva.*factura|capturar.*factura/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Llenar campos mínimos. Los labels exactos dependen del form, usamos
    // expresiones tolerantes.
    await dialog.getByLabel(/proveedor/i).first().click();
    await page.getByRole("option").first().click(); // primer proveedor disponible
    await dialog.getByLabel(/embarque/i).first().click();
    await page.getByRole("option").first().click();
    await dialog.getByLabel(/^total|monto/i).first().fill("1234.56");
    await dialog.getByLabel(/referencia|folio.*proveedor|n[úu]mero/i).first()
      .fill("E2E_TEST");

    const insertResp = page.waitForResponse(
      (r) =>
        /\/rest\/v1\/proveedor_facturas/i.test(r.url()) &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 20_000 },
    );
    await dialog.getByRole("button", { name: /guardar|crear|capturar/i }).click();
    const resp = await insertResp;
    const body = (await resp.json().catch(() => null)) as
      | Array<{ id?: string; folio_interno?: string }>
      | { id?: string; folio_interno?: string }
      | null;
    const row = Array.isArray(body) ? body[0] : body;
    facturaId = row?.id ?? null;
    folio = row?.folio_interno ?? null;

    expect(facturaId, "id de factura no capturado").toBeTruthy();
    if (folio) expect(folio).toMatch(/^FP-\d{6}$/);
  });

  test("registra pago y marca factura como pagada", async ({ page }) => {
    test.skip(!facturaId, "el test previo falló y no hay factura");
    await loginAs(page, internalCreds());
    await page.goto("/compras/facturas-proveedor");

    // Localizar la fila por folio (si lo tenemos) o por referencia.
    const matcher = folio ? new RegExp(folio, "i") : /E2E_TEST/i;
    const row = page.getByRole("row", { name: matcher }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole("button", { name: /registrar.*pago|pagar/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/monto|importe/i).first().fill("1234.56");

    const formaPago = dialog.getByLabel(/forma de pago|m[ée]todo/i).first();
    const tag = await formaPago.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tag === "select") {
      await formaPago.selectOption({ label: /transferencia/i });
    } else {
      await formaPago.click();
      await page.getByRole("option", { name: /transferencia/i }).first().click();
    }

    const pagoResp = page.waitForResponse(
      (r) =>
        /\/rest\/v1\/pagos_proveedor/i.test(r.url()) &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 20_000 },
    );
    await dialog.getByRole("button", { name: /guardar|registrar|confirmar/i }).click();
    await pagoResp;

    // Badge "Pagado" visible en la fila.
    await expect(
      page.getByRole("row", { name: matcher }).getByText(/pagad/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
