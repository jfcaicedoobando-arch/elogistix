/**
 * Ola v16 (4): el término de búsqueda de cobranza viaja escapado a
 * `cobranza_listado`, que arma el patrón `%term%`. Sin escapar, `%` y `_`
 * tecleados por el usuario actuaban como comodines.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { fetchCobranza } from "@/features/facturacion/services/cobranza";

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
});

function paramsUltimaLlamada(): Record<string, unknown> {
  return rpc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

describe("fetchCobranza · escape del buscador", () => {
  it("trata `%` como literal", async () => {
    await fetchCobranza({ search: "100%" });
    expect(paramsUltimaLlamada().p_search).toBe("100\\%");
  });

  it("trata `_` como literal", async () => {
    await fetchCobranza({ search: "F_2026" });
    expect(paramsUltimaLlamada().p_search).toBe("F\\_2026");
  });

  it("no altera un término normal", async () => {
    await fetchCobranza({ search: "ACME" });
    expect(paramsUltimaLlamada().p_search).toBe("ACME");
  });

  it("omite el filtro cuando el término está vacío", async () => {
    await fetchCobranza({ search: "" });
    expect(paramsUltimaLlamada().p_search).toBeUndefined();
  });
});
