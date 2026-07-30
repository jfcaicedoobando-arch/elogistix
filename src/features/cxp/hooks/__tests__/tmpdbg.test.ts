import { describe, it, expect, vi } from "vitest";
const buscar = vi.hoisted(() => vi.fn());
vi.mock("@/features/cxp/services", () => ({ buscarFacturaPorUuidFiscal: buscar }));
import { detectarCfdiDuplicado } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.dup";
describe("x", () => { it("y", async () => {
  buscar.mockImplementation(async () => { throw new Error("network"); });
  const r = await detectarCfdiDuplicado("u").catch((e) => `THREW:${e.message}`);
  console.log("RESULT", r);
  expect(true).toBe(true);
}); });
