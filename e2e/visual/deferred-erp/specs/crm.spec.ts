import { expect, test } from "@playwright/test";
import { CRM_ACTIVE_COMPANY, CRM_DELETED_COMPANY, CRM_OWNERS } from "../crm-backend";
import { assertIsolation, capture, installNetworkGuards } from "./helpers";

test("PR373: real linked-company cards preserve history and restrict unlink to editing", async ({ context, page }, testInfo) => {
  const network = await installNetworkGuards(context, page);
  const facts: Record<string, unknown> = {};
  const backendState = async () => JSON.parse(await page.getByTestId("crm-backend-state").textContent() ?? "{}");
  try {
    await page.goto("/?case=crm", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { name: "CRM PR373 · vínculos ficticios" })).toBeVisible();
    for (const origin of ["contacto", "oportunidad"] as const) {
      for (const mode of ["editable", "readonly", "noConfig"] as const) {
        const card = page.getByTestId(`crm-${origin}-${mode}`);
        await expect(card.getByText("Empresas (2)", { exact: true })).toBeVisible();
        await expect(card.getByRole("listitem")).toHaveCount(2);
        await expect(card.getByRole("link", { name: CRM_ACTIVE_COMPANY.nombre, exact: true }))
          .toHaveAttribute("href", `/crm/empresas/${CRM_ACTIVE_COMPANY.id}`);
        const deleted = card.getByRole("listitem").filter({ hasText: CRM_DELETED_COMPANY.nombre });
        await expect(deleted.getByText(CRM_DELETED_COMPANY.nombre, { exact: true })).toBeVisible();
        await expect(deleted.getByText("Empresa eliminada", { exact: true })).toBeVisible();
        await expect(deleted.getByRole("link")).toHaveCount(0);
        await expect(card.getByRole("link")).toHaveCount(1);
        await expect(card.getByRole("button", { name: /^Quitar vínculo con/ })).toHaveCount(mode === "editable" ? 2 : 0);
        await expect(card.getByRole("button", { name: "Ligar empresa", exact: true })).toHaveCount(mode === "editable" ? 1 : 0);
      }
      const hidden = page.getByTestId(`crm-${origin}-hidden`);
      await expect(hidden.getByText("Empresas (0)", { exact: true })).toBeVisible();
      await expect(hidden.getByText("Sin registros ligados.", { exact: true })).toBeVisible();
      await expect(hidden.getByRole("listitem")).toHaveCount(0);
      await expect(hidden.getByRole("link")).toHaveCount(0);
      await expect(hidden.getByRole("button")).toHaveCount(0);
      await expect(hidden.getByText("Empresa eliminada", { exact: true })).toHaveCount(0);
      facts[`${origin}Initial`] = { activeAnchor: true, historicalNameAndLabelWithoutAnchor: true, nullEmbedOmitted: true, permissionAndConfigurationRequired: true };
    }
    expect((await backendState()).writes).toEqual([]);
    await capture(page, testInfo, "crm-history-and-permissions", true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    for (const origin of ["contacto", "oportunidad"] as const) {
      const card = page.getByTestId(`crm-${origin}-editable`);
      await card.getByRole("button", { name: `Quitar vínculo con ${CRM_DELETED_COMPANY.nombre}`, exact: true }).click();
      await expect(card.getByText("Empresas (1)", { exact: true })).toBeVisible();
      await expect(card.getByText(CRM_DELETED_COMPANY.nombre, { exact: true })).toHaveCount(0);
      await expect(card.getByRole("link", { name: CRM_ACTIVE_COMPANY.nombre, exact: true }))
        .toHaveAttribute("href", `/crm/empresas/${CRM_ACTIVE_COMPANY.id}`);
      // Invalidating the real query preserves unrelated owner records, including history.
      await expect(page.getByTestId(`crm-${origin}-readonly`).getByText(CRM_DELETED_COMPANY.nombre, { exact: true })).toBeVisible();
      facts[`${origin}Unlink`] = { removedOnlyLinkedHistoricalCompany: true, activeAnchorPreserved: true, readonlyOwnerUnaffected: true };
    }
    await expect(page.getByTestId("crm-write-count")).toHaveText("Escrituras simuladas: 2");
    const state = await backendState();
    expect(state.writes).toEqual([
      { table: "crm_empresa_contacto", action: "delete-link", filters: { empresa_id: CRM_DELETED_COMPANY.id, contacto_id: CRM_OWNERS.contacto.editable } },
      { table: "crm_oportunidad_empresa", action: "delete-link", filters: { oportunidad_id: CRM_OWNERS.oportunidad.editable, empresa_id: CRM_DELETED_COMPANY.id } },
    ]);
    expect(state.blocked).toEqual([]);
    for (const origin of ["contacto", "oportunidad"] as const) {
      const table = origin === "contacto" ? "crm_empresa_contacto" : "crm_oportunidad_empresa";
      const ownerColumn = origin === "contacto" ? "contacto_id" : "oportunidad_id";
      for (const owner of Object.values(CRM_OWNERS[origin])) {
        expect(state.reads).toContainEqual({ table, columns: "crm_empresas(id, nombre, deleted_at)", filters: { [ownerColumn]: owner }, limit: 200 });
      }
    }
    facts.backend = state;
    await capture(page, testInfo, "crm-memory-unlink-only", true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await testInfo.attach("crm-diagnostics", {
      body: JSON.stringify({ project: testInfo.project.name, facts, network }, null, 2), contentType: "application/json",
    });
    await assertIsolation(network, testInfo, facts);
  }
});
