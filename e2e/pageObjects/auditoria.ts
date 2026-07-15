/**
 * Page Object — Módulo Auditoría.
 * v13.300.23.
 */
import type { Page, Locator, Response } from "@playwright/test";

const RPC_RE = /\/rpc\/auditoria_embarques_org/i;

export class AuditoriaPO {
  constructor(private readonly page: Page) {}

  waitForRpc(timeout = 20_000): Promise<Response | null> {
    return this.page
      .waitForResponse(
        (r) => RPC_RE.test(r.url()) && r.request().method() === "POST",
        { timeout },
      )
      .catch(() => null);
  }

  async goto(): Promise<Response | null> {
    const rpc = this.waitForRpc();
    await this.page.goto("/auditoria");
    return rpc;
  }

  recalcularBtn(): Locator {
    return this.page.getByTestId("auditoria-recalcular-btn");
  }

  async recalcular(): Promise<Response | null> {
    const rpc = this.waitForRpc(15_000);
    await this.recalcularBtn().click();
    return rpc;
  }
}
