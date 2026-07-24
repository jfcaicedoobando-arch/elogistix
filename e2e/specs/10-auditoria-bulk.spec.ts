/**
 * Flujo 10 — Auditoría operativa: bulk revisar + snooze ≤30 días.
 *
 * Requiere E2E_HAS_AUDIT_DATA=1 y que `auditoria_embarques_org` devuelva ≥3
 * hallazgos para el usuario logueado.
 *
 * v13.139.0 (score + snooze trigger) / v13.139.1 (bulk revisar).
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";
import { bestEffortCleanup } from "../fixtures/cleanup";
import { supabaseRest } from "../fixtures/api";
import { requireFixture } from "../fixtures/requireFixture";

const ENABLED = process.env.E2E_HAS_AUDIT_DATA === "1";

test.describe("Flujo 10 — Auditoría operativa (bulk + snooze)", () => {
  requireFixture(ENABLED, "E2E_HAS_AUDIT_DATA=1 requerido");

  let startTs = "";
  test.beforeEach(() => {
    startTs = new Date().toISOString();
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (!startTs) return;
    // Best-effort: borrar revisiones y snoozes creados por el spec.
    // Filtro doble (timestamp + tag de comentario) por si la columna
    // `created_at` no existe en alguna instalación legacy.
    await bestEffortCleanup(testInfo, "borrar auditoria_revisiones E2E", async () => {
      await supabaseRest(page).delete("auditoria_revisiones", {
        comentario: "like.*E2E_TEST*",
      });
    });
    await bestEffortCleanup(testInfo, "borrar auditoria_revisiones por timestamp", async () => {
      await supabaseRest(page).delete("auditoria_revisiones", {
        created_at: `gte.${startTs}`,
      });
    });
  });


  test("seleccionar múltiples hallazgos y marcarlos como revisados", async ({ page }) => {
    await loginAs(page, internalCreds());

    const auditResp = page
      .waitForResponse(
        (r) => /\/rpc\/auditoria_embarques_org/i.test(r.url()) && r.ok(),
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.goto("/auditoria");
    await auditResp;

    await expect(page.getByRole("heading", { name: /auditor[ií]a/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const total = await rows.count();
    test.skip(total < 3, "Se requieren ≥3 hallazgos para el bulk");

    // Marcar 3 checkboxes de fila.
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).getByRole("checkbox").check();
    }

    // BulkBar debe mostrar el conteo.
    const bulkBar = page.getByText(/3\s*seleccionad/i).first();
    await expect(bulkBar).toBeVisible({ timeout: 5_000 });

    // Marcar como revisados.
    await page.getByRole("button", { name: /marcar.*revisad/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Comentario opcional para identificar como E2E.
    const motivo = dialog.getByLabel(/motivo|comentar/i).first();
    if (await motivo.isVisible().catch(() => false)) {
      await motivo.fill("E2E_TEST — bulk revisar");
    }
    const insertResp = page
      .waitForResponse(
        (r) =>
          /\/rest\/v1\/auditoria_revisiones/i.test(r.url()) &&
          r.request().method() === "POST" &&
          r.ok(),
        { timeout: 20_000 },
      )
      .catch(() => null);
    await dialog.getByRole("button", { name: /confirmar|marcar/i }).click();
    await insertResp;

    // Toast de éxito.
    await expect(
      page
        .locator('[role="status"], [data-sonner-toast]')
        .filter({ hasText: /revisad|marcad/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("snooze valida límite de 30 días", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/auditoria");

    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    // Abrir menú de acciones de la fila.
    await firstRow.getByRole("button", { name: /acciones|abrir menú|opciones/i }).first().click();
    await page.getByRole("menuitem", { name: /snooze|posponer/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Intentar 35 días — debe rechazar.
    const dias = dialog.getByLabel(/d[íi]as|hasta/i).first();
    await dias.fill("35");
    await dialog.getByRole("button", { name: /confirmar|snooze|posponer/i }).click();
    await expect(
      page
        .locator('[role="status"], [data-sonner-toast], [role="alert"]')
        .filter({ hasText: /30|m[áa]ximo|l[íi]mite/i })
        .first(),
    ).toBeVisible({ timeout: 8_000 });

    // Cerrar diálogo para no contaminar otros tests.
    await page.keyboard.press("Escape");
  });
});
