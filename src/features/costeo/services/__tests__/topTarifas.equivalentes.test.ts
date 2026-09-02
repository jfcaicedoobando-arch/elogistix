import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchTopTarifas } from "../topTarifas";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("fetchTopTarifas con IDs equivalentes", () => {
  it("consulta todos los IDs, deduplica y ordena por total", async () => {
    mock.setRpcResult("get_top_tarifas", {
      data: [
        { id: "t2", total_comparable: 2000, dias_credito: 0, dias_libres_demoras: 7 },
        { id: "t1", total_comparable: 1000, dias_credito: 0, dias_libres_demoras: 7 },
      ],
      error: null,
    });

    const res = await fetchTopTarifas({
      puertoOrigenId: "po",
      puertoDestinoId: "pd",
      tipoContenedorId: "tc-canonico",
      tipoContenedorIds: ["tc-canonico", "tc-legacy", "tc-legacy"],
      fecha: "2026-06-12",
      organizationId: "org-1",
    });

    // Un RPC por ID único (los repetidos se colapsan).
    expect(mock.rpcCalls).toHaveLength(2);
    const ids = mock.rpcCalls.map(
      (c) => (c.args as Record<string, unknown>).p_tipo_contenedor_id,
    );
    expect(ids.sort()).toEqual(["tc-canonico", "tc-legacy"]);

    // Filas repetidas entre lotes se deduplican por id y quedan ordenadas.
    expect(res.map((r) => r.id)).toEqual(["t1", "t2"]);
  });

  it("cae al ID simple cuando no se pasan equivalentes", async () => {
    mock.setRpcResult("get_top_tarifas", { data: [], error: null });
    await fetchTopTarifas({ puertoOrigenId: "po", puertoDestinoId: "pd", tipoContenedorId: "tc" });
    expect(mock.rpcCalls).toHaveLength(1);
  });
});
