/**
 * Page Object — Listado y detalle de Embarques.
 * v13.300.23.
 */
import type { Page, Locator, Response } from "@playwright/test";
import { expect } from "@playwright/test";

export class EmbarquesListPO {
  constructor(private readonly page: Page) {}

  async goto(): Promise<Response | null> {
    const listResp = this.page
      .waitForResponse(
        (r) => /\/rest\/v1\/embarques/i.test(r.url()) && r.request().method() === "GET",
        { timeout: 20_000 },
      )
      .catch(() => null);
    await this.page.goto("/embarques");
    return listResp;
  }

  rows(): Locator {
    return this.page.locator("table tbody tr");
  }

  async openFirstRow(): Promise<void> {
    const rows = this.rows();
    await rows.first().waitFor({ state: "visible", timeout: 20_000 });
    await rows.first().click();
    await expect(this.page).toHaveURL(/\/embarques\/[0-9a-f-]{36}/i, { timeout: 15_000 });
  }
}

export class EmbarqueDetallePO {
  constructor(private readonly page: Page) {}

  tab(name: "resumen" | "tracking" | "documentos" | "costos" | "facturacion"): Locator {
    return this.page.getByTestId(`tab-${name}`);
  }

  estadoProgreso(): Locator {
    return this.page.getByTestId("estado-progreso");
  }

  async isArribado(): Promise<boolean> {
    const value = await this.estadoProgreso().getAttribute("data-arrived").catch(() => null);
    return value === "true";
  }

  async openTab(name: "resumen" | "tracking" | "documentos"): Promise<void> {
    await this.tab(name).click();
  }
}
