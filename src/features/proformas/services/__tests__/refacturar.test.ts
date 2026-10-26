import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { refacturarProforma } from "../refacturar";
const actual = { embarque_id: "e1", anterior_numero: "P1", factura_cancelada: "F1", conceptos: ["c1"], notas_sugeridas: "Linaje" };
beforeEach(() => vi.resetAllMocks());
describe("refacturar RPC: contrato de la migración aplicada recuperada", () => {
  it("devuelve el formulario, no inventa un id de proforma creada", async () => {
    rpc.mockResolvedValue({ data: actual, error: null });
    expect(await refacturarProforma("p1")).toEqual(actual);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("refacturar_proforma_rpc", { p_proforma_id: "p1" });
  });
  it.each([null, {}, { nueva_proforma_id: "p2", nuevo_numero: "P2" }, { ...actual, conceptos: [] }])(
    "rechaza contratos incompletos o antiguos sin navegar a undefined", async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      await expect(refacturarProforma("p1")).rejects.toThrow("puede haber quedado cancelada");
      expect(rpc).toHaveBeenCalledOnce();
    },
  );
  it("conserva el error remoto sin reintentar", async () => {
    const error = new Error("LC_PROFORMA_FACTURADA");
    rpc.mockResolvedValue({ data: null, error });
    await expect(refacturarProforma("p1")).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
