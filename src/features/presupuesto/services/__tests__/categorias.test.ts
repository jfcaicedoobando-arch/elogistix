import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import {
  fetchCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  seedCategoriasDefault,
} from "../categorias";

describe("presupuesto/categorias", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("fetchCategorias devuelve [] si data null", async () => {
    mockRef.current!.setTableResult("presupuesto_categorias", { data: null, error: null });
    const r = await fetchCategorias(true);
    expect(r).toEqual([]);
  });

  it("fetchCategorias propaga error", async () => {
    mockRef.current!.setTableResult("presupuesto_categorias", { data: null, error: new Error("boom") });
    await expect(fetchCategorias()).rejects.toThrow("boom");
  });

  it("crearCategoria llama insert y devuelve fila", async () => {
    mockRef.current!.setTableResult("presupuesto_categorias", { data: { id: "x" }, error: null });
    const r = await crearCategoria({ nombre: "Renta" } as never);
    expect(r).toEqual({ id: "x" });
  });

  it("actualizarCategoria propaga error", async () => {
    mockRef.current!.setTableResult("presupuesto_categorias", { data: null, error: new Error("e") });
    await expect(actualizarCategoria("1", { nombre: "x" } as never)).rejects.toThrow("e");
  });

  it("eliminarCategoria no lanza en éxito", async () => {
    mockRef.current!.setTableResult("presupuesto_categorias", { data: null, error: null });
    await expect(eliminarCategoria("1")).resolves.toBeUndefined();
  });

  it("seedCategoriasDefault invoca RPC con organization_id", async () => {
    mockRef.current!.setRpcResult("seed_presupuesto_categorias", { data: null, error: null });
    await seedCategoriasDefault("org-1");
  });
});
