import { describe, it, expect, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchBitacora } from "../index";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("bitacora/index", () => {
  it("fetchBitacora realiza consulta paginada y devuelve count", async () => {
    // El helper compartido pasa el response completo a `then`, así que count
    // se incluye junto a data/error aunque el tipo nominal no lo exponga.
    mock.setTableResult("bitacora_actividad", {
      data: [],
      error: null,
      count: 10,
    } as any);
    const result = await fetchBitacora({ pagina: 1, limite: 10 });
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad");
    expect(call).toBeTruthy();
    const rangeIdx = call!.ops.indexOf("range");
    expect(call!.opArgs[rangeIdx]).toEqual([10, 19]);
    expect(result.total).toBe(10);
  });

  it("fetchBitacora aplica filtro .eq('modulo', 'crm')", async () => {
    mock.setTableResult("bitacora_actividad", { data: [], error: null } as any);
    await fetchBitacora({ modulo: "crm" });
    const call = mock.tableCalls.find((c) => c.table === "bitacora_actividad")!;
    const eqArgs = call.ops
      .map((op, i) => (op === "eq" ? call.opArgs[i] : null))
      .filter((x): x is unknown[] => x !== null);
    expect(eqArgs).toContainEqual(["modulo", "crm"]);
  });
});
