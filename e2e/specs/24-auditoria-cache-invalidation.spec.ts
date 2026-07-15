/**
 * Flujo 24 — Auditoría: la caché se invalida tras cambios (13.300.20).
 * v13.300.23 — usa PO + testid del botón Recalcular (evita match con sidebar).
 */
import { test, expect } from "../fixtures/pageErrors";
import { internalCreds, loginAs } from "../fixtures/auth";
import { AuditoriaPO } from "../pageObjects/auditoria";

test.describe("Flujo 24 — Auditoría · invalidación de caché", () => {
  test("navegar a /auditoria dispara el RPC y expone el botón Recalcular", async ({ page }) => {
    await loginAs(page, internalCreds());

    const po = new AuditoriaPO(page);
    const resp = await po.goto();
    expect(resp, "Debe dispararse la RPC de auditoría al entrar a la página").not.toBeNull();

    await expect(page.getByRole("heading", { name: /auditor[ií]a/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const btn = po.recalcularBtn();
    await expect(btn).toBeVisible({ timeout: 10_000 });

    const resp2 = await po.recalcular();
    expect(resp2, "Recalcular debe reejecutar la RPC de auditoría").not.toBeNull();
  });
});
