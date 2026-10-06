import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: process.cwd() });
async function messages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax" || m.ruleId?.startsWith("architecture/") || m.ruleId === "no-restricted-imports");
}

describe("effective independent architecture policies", () => {
  for (const layer of ["domain", "hooks", "services", "components"]) {
    const path = `src/features/cxc/${layer}/__policy_probe.ts`;
    it(`keeps monetary, query and formatter guards in ${layer}`, async () => {
      const config = await eslint.calculateConfigForFile(path);
      expect(config.rules["no-restricted-syntax"][1]).toBeDefined();
      const result = await messages('export const amount = Math.round(1.005 * 100) / 100; export const options = { queryKey: ["probe"] }; export const text = amount.toLocaleString();', path);
      expect(result.filter((m) => m.ruleId === "no-restricted-syntax")).toHaveLength(3);
    });
  }
  it("keeps domain and cross-feature boundaries simultaneously", async () => {
    const result = await messages('import { x } from "@/features/cxc/services/private"; import { y } from "@/features/cxp/components/private"; export const value = [x, y];', "src/features/cxc/domain/__policy_probe.ts");
    expect(result.some((m) => m.ruleId === "architecture/layers")).toBe(true);
    expect(result.some((m) => /Cross-feature/.test(m.message))).toBe(true);
  });
  it("keeps service UI boundaries and design system policy", async () => {
    const result = await messages('import { x } from "@/features/cxc/components/private"; import { toast } from "sonner"; export const value = [x, toast];', "src/features/cxc/services/__policy_probe.ts");
    expect(result.some((m) => m.ruleId === "architecture/layers")).toBe(true);
    expect(result.some((m) => m.ruleId === "architecture/design-system")).toBe(true);
  });
  it("retains test fixtures and formatter implementation exemptions", async () => {
    expect(await messages('export const fixture = { queryKey: ["test"] };', "src/features/cxc/domain/policy.test.ts")).toEqual([]);
    expect(await messages('export const text = (1).toLocaleString();', "src/lib/formatters/__policy_probe.ts")).toEqual([]);
  });
  it("accepts canonical helpers and public feature APIs", async () => {
    expect(await messages('import { roundMoney } from "@/lib/financial/financialUtils"; import { queryKeys } from "@/features/cxp"; export const value = { amount: roundMoney(1.005), queryKey: queryKeys };', "src/features/cxc/hooks/__policy_probe.ts")).toEqual([]);
  });
});

it("protects the first public financial read boundary without broadening a baseline", async () => {
  const result = await messages('import { fetchVentaFacturadaEmbarques } from "@/features/facturacion/services/shared/ventaFacturada"; export const read = fetchVentaFacturadaEmbarques;', "src/features/profit/services/__policy_probe.ts");
  expect(result.some((m) => m.ruleId === "architecture/public-financial-api")).toBe(true);
});
it("blocks reintroduction of retired non-atomic payment entrypoints", async () => {
  const result = await messages('import { crearMovimientoBancarioPago } from "@/features/cxp/services/pagoProveedorMovimiento"; export const write = crearMovimientoBancarioPago;', "src/features/facturacion/services/__policy_probe.ts");
  expect(result.some((m) => m.ruleId === "architecture/retired-money-api")).toBe(true);
});
