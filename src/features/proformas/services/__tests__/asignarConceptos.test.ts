import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { asignarConceptosAProforma } from "../asignarConceptos";

describe("asignarConceptosAProforma", () => {
  beforeEach(() => rpc.mockReset());

  it("invoca el RPC con los parámetros esperados", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await asignarConceptosAProforma("p1", ["c1", "c2"]);
    expect(rpc).toHaveBeenCalledWith("asignar_conceptos_a_proforma", {
      p_proforma_id: "p1",
      p_concepto_ids: ["c1", "c2"],
    });
  });

  it("acepta arreglo vacío (des-asignación total)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await asignarConceptosAProforma("p1", []);
    expect(rpc).toHaveBeenCalledWith("asignar_conceptos_a_proforma", { p_proforma_id: "p1", p_concepto_ids: [] });
  });

  it("propaga el error del RPC asignar_conceptos", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "no perms" } });
    await expect(asignarConceptosAProforma("p1", ["c1"])).rejects.toMatchObject({ message: "no perms" });
  });
});
