/**
 * Visibilidad por empresa de catálogos globales: apagar inserta la fila,
 * encender la borra, y repetir la operación no debe fallar (idempotencia).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  del: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: mocks.insert,
      delete: mocks.del,
      select: mocks.select,
    }),
  },
}));

import { fetchDesactivadosOrg, setActivoOrg } from "../catalogoOrgVisibilidad";

function eqChain(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(() => chain),
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
  };
  return chain;
}

beforeEach(() => {
  mocks.insert.mockReset();
  mocks.del.mockReset();
  mocks.select.mockReset();
});

describe("setActivoOrg", () => {
  it("apagar inserta el elemento en la lista de apagados de la empresa", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: null });
    await setActivoOrg("puertos", "p1", false);
    expect(mocks.insert).toHaveBeenCalledWith({ catalogo: "puertos", item_id: "p1" });
  });

  it("apagar dos veces no falla (duplicado 23505 es el estado deseado)", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    await expect(setActivoOrg("navieras", "n1", false)).resolves.toBeUndefined();
  });

  it("propaga errores reales al apagar", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });
    // El servicio propaga tal cual el error de Postgres (no lo envuelve).
    await expect(setActivoOrg("navieras", "n1", false)).rejects.toMatchObject({
      code: "42501",
      message: "denied",
    });
  });

  it("encender borra la fila de apagado", async () => {
    const chain = eqChain({ data: null, error: null });
    mocks.del.mockReturnValue(chain);
    await setActivoOrg("tipos_contenedor", "t1", true);
    expect(chain.eq).toHaveBeenCalledWith("catalogo", "tipos_contenedor");
    expect(chain.eq).toHaveBeenCalledWith("item_id", "t1");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("fetchDesactivadosOrg", () => {
  it("devuelve el conjunto de IDs apagados", async () => {
    mocks.select.mockReturnValue(eqChain({ data: [{ item_id: "a" }, { item_id: "b" }], error: null }));
    const set = await fetchDesactivadosOrg("puertos");
    expect(set.has("a")).toBe(true);
    expect(set.has("z")).toBe(false);
    expect(set.size).toBe(2);
  });
});
