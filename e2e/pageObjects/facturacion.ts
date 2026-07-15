/**
 * Page Object — Facturación / Por cobrar.
 * v13.300.23.
 */
import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export class FacturacionPO {
  constructor(private readonly page: Page) {}

  async gotoPorCobrar(): Promise<void> {
    await this.page.goto("/facturacion?tab=por-cobrar");
    await expect(
      this.page.getByRole("heading", { name: /facturaci/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const tab = this.page.getByRole("tab", { name: /por cobrar/i }).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
    }
  }

  rows(): Locator {
    return this.page.locator("table tbody tr");
  }

  venceEnCells(): Locator {
    return this.page.getByTestId("col-vence-en");
  }
}
