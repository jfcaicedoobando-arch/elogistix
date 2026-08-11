/**
 * v13.510.0 — Categoría COGS fija en modo buzón + priorización del expediente.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useCategoriaCogsBuzon, encontrarCategoriaCogs,
} from "@/features/cxp/hooks/useCategoriaCogsBuzon";
import { separarGrupoPrioritario, type Grupo } from "@/features/cxp/components/vincularEmbarqueHelpers";
import type { CategoriaPresupuestoLite } from "@/features/cxp/types";

const CATS: CategoriaPresupuestoLite[] = [
  { id: "cogs", nombre: "Costo directo", tipo_contable: "CostoDirectoEmbarque" },
  { id: "adm", nombre: "Administración", tipo_contable: "Administracion" },
];

describe("encontrarCategoriaCogs", () => {
  it("devuelve la categoría de costo directo", () => {
    expect(encontrarCategoriaCogs(CATS)?.id).toBe("cogs");
  });
  it("devuelve null cuando no existe", () => {
    expect(encontrarCategoriaCogs([CATS[1]])).toBeNull();
  });
});

describe("useCategoriaCogsBuzon", () => {
  it("fija COGS y bloquea el selector cuando hay documento del buzón", () => {
    const onCategoria = vi.fn();
    const { result } = renderHook(() =>
      useCategoriaCogsBuzon({
        categorias: CATS, documentoId: "doc-1", expediente: "ELIMP00302",
        abierto: true, categoriaActual: "cogs", onCategoria,
      }),
    );
    expect(onCategoria).not.toHaveBeenCalled(); // ya estaba en COGS
    expect(result.current.bloqueada).toBe(true);
    expect(result.current.motivo).toContain("ELIMP00302");
  });

  it("selecciona COGS cuando el formulario viene vacío", () => {
    const onCategoria = vi.fn();
    renderHook(() =>
      useCategoriaCogsBuzon({
        categorias: CATS, documentoId: "doc-1", abierto: true,
        categoriaActual: "", onCategoria,
      }),
    );
    expect(onCategoria).toHaveBeenCalledWith("cogs");
  });

  it("no pisa una elección manual previa del contador", () => {
    const onCategoria = vi.fn();
    const { result } = renderHook(() =>
      useCategoriaCogsBuzon({
        categorias: CATS, documentoId: "doc-1", abierto: true,
        categoriaActual: "adm", onCategoria,
      }),
    );
    expect(onCategoria).not.toHaveBeenCalled();
    expect(result.current.bloqueada).toBe(false);
  });

  it("permite desbloquear el selector", () => {
    const { result } = renderHook(() =>
      useCategoriaCogsBuzon({
        categorias: CATS, documentoId: "doc-1", abierto: true,
        categoriaActual: "cogs", onCategoria: vi.fn(),
      }),
    );
    act(() => result.current.desbloquear());
    expect(result.current.bloqueada).toBe(false);
  });

  it("avisa cuando la organización no tiene categoría COGS", () => {
    const { result } = renderHook(() =>
      useCategoriaCogsBuzon({
        categorias: [CATS[1]], documentoId: "doc-1", abierto: true,
        categoriaActual: "", onCategoria: vi.fn(),
      }),
    );
    expect(result.current.bloqueada).toBe(false);
    expect(result.current.avisoSinCogs).toContain("Presupuesto");
  });

  it("en captura manual no bloquea nada", () => {
    const onCategoria = vi.fn();
    const { result } = renderHook(() =>
      useCategoriaCogsBuzon({
        categorias: CATS, documentoId: null, abierto: true,
        categoriaActual: "", onCategoria,
      }),
    );
    expect(onCategoria).not.toHaveBeenCalled();
    expect(result.current.bloqueada).toBe(false);
  });
});

describe("separarGrupoPrioritario", () => {
  const grupos: Grupo[] = [
    { embarqueId: "e1", expediente: "A-1", items: [] },
    { embarqueId: "e2", expediente: "A-2", items: [] },
  ];

  it("separa el expediente del documento del resto", () => {
    const r = separarGrupoPrioritario(grupos, "e2");
    expect(r.prioritario?.embarqueId).toBe("e2");
    expect(r.otros.map((g) => g.embarqueId)).toEqual(["e1"]);
  });

  it("sin embarque prioritario devuelve todo como otros", () => {
    const r = separarGrupoPrioritario(grupos, null);
    expect(r.prioritario).toBeNull();
    expect(r.otros).toHaveLength(2);
  });

  it("prioritario null cuando el expediente no tiene costos pendientes", () => {
    const r = separarGrupoPrioritario(grupos, "e9");
    expect(r.prioritario).toBeNull();
    expect(r.otros).toHaveLength(2);
  });
});
