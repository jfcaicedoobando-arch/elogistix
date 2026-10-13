import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Modela la proyección de PostgREST: una columna no seleccionada no aparece
// en la respuesta, aunque esté guardada. No usa conexiones ni datos reales.
const db = vi.hoisted(() => {
  const state = {
    row: null as Record<string, unknown> | null,
    error: null as Error | null,
    selects: [] as string[],
    filters: [] as Array<[string, unknown]>,
  };
  const from = vi.fn(() => {
    let columns = "*";
    const filters: Array<[string, unknown]> = [];
    const filter = (column: string, value: unknown) => {
      filters.push([column, value]);
      state.filters.push([column, value]);
      return chain;
    };
    const read = async () => {
      const row = state.row;
      if (state.error) return { data: null, error: state.error };
      if (!row || filters.some(([key, value]) => row[key] !== value)) {
        return { data: null, error: null };
      }
      const data = columns === "*" ? { ...row } : Object.fromEntries(
        columns.split(",").map((column) => [column.trim(), row[column.trim()]]),
      );
      return { data, error: null };
    };
    const chain = {
      select: (value = "*") => {
        columns = value;
        state.selects.push(value);
        return chain;
      },
      insert: (value: Record<string, unknown>) => {
        state.row = { ...state.row, ...value };
        return chain;
      },
      update: (value: Record<string, unknown>) => {
        state.row = { ...state.row, ...value };
        return chain;
      },
      eq: filter,
      is: filter,
      single: read,
      maybeSingle: read,
    };
    return chain;
  });
  return { state, supabase: { from } };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: db.supabase }));
vi.mock("../proveedoresBitacora", () => ({ bitacoraProveedor: vi.fn().mockResolvedValue(undefined) }));

import { fetchProveedor, insertProveedor, updateProveedor } from "../proveedoresCrud";
import { EMPTY_PROVEEDOR_FORM } from "../../hooks/useNuevoProveedorController.constants";
import { preparePayload } from "../../hooks/useNuevoProveedorController.helpers";
import { useEditarProveedorController } from "../../hooks/useEditarProveedorController";

const form = {
  ...EMPTY_PROVEEDOR_FORM,
  nombre: "Proveedor ficticio",
  rfc: "XAXX010101000",
  categoria: "Logistico" as const,
  tipo: "Administrativo" as const,
  origen_proveedor: "Nacional" as const,
};

describe("proveedor: crédito guardado y relectura del editor", () => {
  beforeEach(() => {
    db.state.row = {
      ...form, id: "proveedor-mock", organization_id: "org-mock",
      updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
    };
    db.state.error = null;
    db.state.selects = [];
    db.state.filters = [];
    vi.clearAllMocks();
  });

  it.each([0, 30, 60])("alta conserva %i días al abrir el editor", async (dias) => {
    const prepared = preparePayload({ ...form, dias_credito: dias });
    if (!prepared.ok) throw new Error(prepared.mensaje);
    expect(prepared.payload.dias_credito).toBe(dias);
    await insertProveedor(prepared.payload);
    expect(db.state.row?.dias_credito).toBe(dias);

    const proveedor = await fetchProveedor("proveedor-mock");
    if (!proveedor) throw new Error("Falta proveedor de prueba");
    expect(proveedor.dias_credito).toBe(dias);
    expect(db.state.selects.at(-1)?.split(",").map((key) => key.trim())).toContain("dias_credito");
    expect(db.state.filters).toEqual([["id", "proveedor-mock"], ["deleted_at", null]]);

    const { result } = renderHook(() => useEditarProveedorController(proveedor, true, updateProveedor, vi.fn()));
    expect(result.current.form.dias_credito).toBe(dias);
  });

  it("edita 30 → 60 → 0 y reabre sin restaurar un valor por defecto", async () => {
    db.state.row = { ...db.state.row, dias_credito: 30 };
    const initial = await fetchProveedor("proveedor-mock");
    if (!initial) throw new Error("Falta proveedor de prueba");
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ proveedor, open }) => useEditarProveedorController(proveedor, open, updateProveedor, onClose),
      { initialProps: { proveedor: initial, open: true } },
    );
    expect(result.current.form.dias_credito).toBe(30);
    for (const dias of [60, 0]) {
      act(() => result.current.setField("dias_credito", dias));
      await act(async () => { await result.current.handleSave(); });
      expect(db.state.row?.dias_credito).toBe(dias);
      const proveedor = await fetchProveedor("proveedor-mock");
      if (!proveedor) throw new Error("Falta proveedor de prueba");
      rerender({ proveedor, open: false });
      rerender({ proveedor, open: true });
      expect(result.current.form.dias_credito).toBe(dias);
    }
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(db.state.filters).toContainEqual(["organization_id", "org-mock"]);
    expect(db.state.filters).toContainEqual(["updated_at", "2026-01-01T00:00:00Z"]);
  });

  it("conserva ausencia y errores de lectura, sin fabricar un proveedor", async () => {
    db.state.row = null;
    await expect(fetchProveedor("proveedor-mock")).resolves.toBeNull();
    db.state.error = new Error("lectura fallida");
    await expect(fetchProveedor("proveedor-mock")).rejects.toThrow("lectura fallida");
  });

  it("sigue excluyendo al proveedor dado de baja", async () => {
    db.state.row = { ...db.state.row, dias_credito: 30, deleted_at: "2026-01-02T00:00:00Z" };
    await expect(fetchProveedor("proveedor-mock")).resolves.toBeNull();
  });
});
