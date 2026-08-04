/**
 * Emparejamiento de proveedor por nombre (facturas PDF sin Tax ID impreso).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => from(t) },
}));

import {
  normalizarNombreProveedor,
  buscarProveedorPorNombreEnOrg,
} from "../matchProveedorPorNombre";

const ORG = "org-1";

/** Builder mínimo: alias (maybeSingle) y proveedores (lista). */
function mockTables(opts: {
  alias?: { proveedor_id: string; proveedores: { id: string; nombre: string; deleted_at: string | null } } | null;
  proveedores?: { id: string; nombre: string }[];
}) {
  from.mockImplementation((tabla: string) => {
    if (tabla === "proveedor_alias") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: opts.alias ?? null, error: null }),
      };
      return chain;
    }
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      limit: async () => ({ data: opts.proveedores ?? [], error: null }),
    };
    return chain;
  });
}

describe("normalizarNombreProveedor", () => {
  it("quita sufijos societarios, puntuación y acentos", () => {
    expect(normalizarNombreProveedor("HK LS Limited.")).toBe("HK LS");
    expect(normalizarNombreProveedor("Acme Co., Ltd")).toBe("ACME");
    expect(normalizarNombreProveedor("Logística Marítima S de RL de CV")).toBe("LOGISTICA MARITIMA");
  });

  it("no vacía nombres que sólo son un sufijo", () => {
    expect(normalizarNombreProveedor("Limited")).toBe("LIMITED");
  });
});

describe("buscarProveedorPorNombreEnOrg", () => {
  beforeEach(() => { from.mockReset(); });

  it("empareja por nombre normalizado aunque el PDF no traiga Tax ID", async () => {
    mockTables({ proveedores: [{ id: "p1", nombre: "HK LS LIMITED" }, { id: "p2", nombre: "Otro" }] });
    const r = await buscarProveedorPorNombreEnOrg("HK LS Limited", ORG);
    expect(r.origen).toBe("nombre");
    expect(r.proveedor?.id).toBe("p1");
  });

  it("prefiere el alias aprendido", async () => {
    mockTables({
      alias: { proveedor_id: "p9", proveedores: { id: "p9", nombre: "Long Sailing", deleted_at: null } },
      proveedores: [],
    });
    const r = await buscarProveedorPorNombreEnOrg("HK LS LIMITED", ORG);
    expect(r.origen).toBe("alias");
    expect(r.proveedor?.id).toBe("p9");
  });

  it("no vincula nada si hay ambigüedad", async () => {
    mockTables({
      proveedores: [{ id: "a", nombre: "HK LS LIMITED" }, { id: "b", nombre: "HK LS Ltd" }],
    });
    const r = await buscarProveedorPorNombreEnOrg("HK LS", ORG);
    expect(r.proveedor).toBeNull();
    expect(r.origen).toBe("ninguno");
  });

  it("ignora nombres muy cortos o sin organización", async () => {
    mockTables({ proveedores: [{ id: "a", nombre: "HK LS LIMITED" }] });
    expect((await buscarProveedorPorNombreEnOrg("HK", ORG)).proveedor).toBeNull();
    expect((await buscarProveedorPorNombreEnOrg("HK LS LIMITED", null)).proveedor).toBeNull();
  });
});
