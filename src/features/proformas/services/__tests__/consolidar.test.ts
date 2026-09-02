import { describe, it, expect, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { consolidarProformas } from "@/features/proformas/services/consolidar";

const base = {
  organizationId: "org-1",
  embarqueId: "emb-1",
  clienteId: "cli-1",
  clienteNombre: "ACME",
  expediente: "EXP-001",
  blMaster: "BLM-1",
  operador: "Maersk",
  diasCredito: 30,
  tasaIva: 0.16,
};

describe("consolidarProformas", () => {
  it("rechaza si hay menos de 2 proformas seleccionadas", async () => {
    await expect(
      consolidarProformas({ ...base, proformaIds: ["p1"] }),
    ).rejects.toThrow(/al menos 2/);
  });

  it("invoca la RPC con todos los parámetros mapeados", async () => {
    const row = { id: "new", organization_id: "org-1" };
    mock.setRpcResult("consolidar_proformas", { data: row, error: null });
    const result = await consolidarProformas({
      ...base,
      proformaIds: ["p1", "p2"],
      requestId: "req-1",
    });
    expect(result).toEqual(row);
    // La bitácora también viaja por RPC (DEFECTO 8): busca la llamada del caso.
    const call = mock.rpcCalls.filter((c) => c.fn === "consolidar_proformas").at(-1)!;
    expect(call.fn).toBe("consolidar_proformas");
    expect(call.args).toMatchObject({
      p_organization_id: "org-1",
      p_proforma_ids: ["p1", "p2"],
      p_embarque_id: "emb-1",
      p_tasa_iva: 0.16,
      p_request_id: "req-1",
    });
  });

  it("aplica defaults cuando bl_master/operador/dias_credito son null", async () => {
    mock.setRpcResult("consolidar_proformas", { data: { id: "x" }, error: null });
    await consolidarProformas({
      ...base, blMaster: null, operador: null, diasCredito: null,
      proformaIds: ["a", "b"],
    });
    expect(mock.rpcCalls.filter((c) => c.fn === "consolidar_proformas").at(-1)?.args).toMatchObject({
      p_bl_master: "", p_operador: "", p_dias_credito: 0,
    });
  });

  it("propaga el error de la RPC", async () => {
    mock.setRpcResult("consolidar_proformas", { data: null, error: new Error("nope") });
    await expect(
      consolidarProformas({ ...base, proformaIds: ["a", "b"] }),
    ).rejects.toThrow("nope");
  });

  it("lanza si la RPC devuelve data null sin error", async () => {
    mock.setRpcResult("consolidar_proformas", { data: null, error: null });
    await expect(
      consolidarProformas({ ...base, proformaIds: ["a", "b"] }),
    ).rejects.toThrow(/no devolvió/);
  });
});
