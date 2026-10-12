import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TablesInsert } from "@/integrations/supabase/types";
import { IMPORT_LOTE_TAMANO } from "@/lib/csv/importLimits";
import { mapProveedorRows } from "@/lib/csv/importSchemaProveedor";
import { insertProveedoresLote } from "../importLote";
import { ProveedorDuplicadoError } from "../duplicadoRfc";

type ProveedorInsert = TablesInsert<"proveedores">;
type Alta = ProveedorInsert & { id: string };
const transport = vi.hoisted(() => ({
  from: vi.fn(), bulk: vi.fn(), single: vi.fn(), read: vi.fn(), duplicate: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: transport }));

let persisted: Alta[];
let events: string[];
let failAt: number;
let singleWrites: number;
let rowFailure: unknown;

function proveedor(index: number, withRfc = true): ProveedorInsert {
  return {
    nombre: ` proveedor ${index} `, tipo: "Naviera", organization_id: "org-test",
    rfc: withRfc ? `TST${String(index).padStart(9, "0")}` : "",
    email: `proveedor${index}@example.invalid`,
  };
}

function confirm(payload: ProveedorInsert): Alta {
  const data = { ...payload, id: `alta-${persisted.length + 1}` };
  persisted.push(data);
  return data;
}

function fallback() {
  transport.bulk.mockResolvedValue({ data: null, error: { code: "23505", message: "Conflicto de lote" } });
}

function progress() {
  return vi.fn((count: number) => { events.push(`progress:${count}`); });
}

beforeEach(() => {
  Object.values(transport).forEach((mock) => mock.mockReset());
  persisted = [];
  events = [];
  failAt = 0;
  singleWrites = 0;
  rowFailure = { message: "Fallo de fila simulado", details: "Transporte en memoria" };
  // Every service request uses this in-memory transport, including the real
  // insertProveedor and duplicate lookup. Fail closed on accidental networking.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Red no permitida en esta suite"); }));
  transport.read.mockImplementation(async (column: "nombre" | "rfc", values: string[]) => ({
    data: persisted.filter((row) => values.includes(row[column] ?? "")), error: null,
  }));
  transport.bulk.mockImplementation(async (payload: ProveedorInsert[]) => {
    events.push(`bulk:${payload.length}`);
    return { data: payload.map(confirm), error: null };
  });
  transport.single.mockImplementation(async (payload: ProveedorInsert) => {
    singleWrites += 1;
    events.push(`single:${payload.nombre}`);
    if (singleWrites === failAt) return { data: null, error: rowFailure };
    return { data: confirm(payload), error: null };
  });
  transport.duplicate.mockResolvedValue({ data: null, error: null });
  transport.from.mockImplementation((table: string) => {
    expect(table).toBe("proveedores");
    const readChain = {
      select: () => readChain, is: () => readChain, eq: () => readChain,
      ilike: () => readChain, limit: () => readChain,
      in: transport.read, maybeSingle: transport.duplicate,
    };
    return {
      ...readChain,
      insert: (payload: ProveedorInsert | ProveedorInsert[]) => Array.isArray(payload)
        ? { select: () => transport.bulk(payload) }
        : { select: () => ({ single: () => transport.single(payload) }) },
    };
  });
});

describe("insertProveedoresLote: altas confirmadas con transporte en memoria", () => {
  it("conserva lotes normales, orden, payloads y progreso acumulado", async () => {
    const rows = Array.from({ length: IMPORT_LOTE_TAMANO + 5 }, (_, i) => proveedor(i + 1));
    const onProgress = progress();
    const result = await insertProveedoresLote(rows, onProgress);
    expect(transport.bulk.mock.calls.map(([batch]) => batch.length)).toEqual([200, 5]);
    expect(transport.single).not.toHaveBeenCalled();
    expect(result).toEqual({ creados: persisted, omitidos: 0 });
    expect(result.creados.map((row) => row.nombre)).toEqual(rows.map((row) => row.nombre.trim().toUpperCase()));
    expect(result.creados[0]).toMatchObject({ ...rows[0], nombre: "PROVEEDOR 1" });
    expect(onProgress.mock.calls).toEqual([[200], [205]]);
    expect(events).toEqual(["bulk:200", "progress:200", "bulk:5", "progress:205"]);
    expect(rows[0].nombre).toBe(" proveedor 1 ");
  });

  it("confirma cada alta del fallback antes de la siguiente y sin repetir el total", async () => {
    fallback();
    const onProgress = progress();
    const result = await insertProveedoresLote([proveedor(1), proveedor(2), proveedor(3)], onProgress);
    expect(result).toEqual({ creados: persisted, omitidos: 0 });
    expect(result.creados).toHaveLength(3);
    expect(onProgress.mock.calls).toEqual([[1], [2], [3]]);
    expect(events).toEqual([
      "single:PROVEEDOR 1", "progress:1", "single:PROVEEDOR 2", "progress:2",
      "single:PROVEEDOR 3", "progress:3",
    ]);
  });

  it.each([true, false])("mantiene dedupe existente e interno y orden (RFC=%s)", async (withRfc) => {
    persisted.push({ ...proveedor(9, withRfc), nombre: "PROVEEDOR 9", id: "existente" });
    const first = proveedor(1, withRfc);
    const duplicate = { ...first, nombre: withRfc ? "OTRO NOMBRE" : " PROVEEDOR 1 " };
    fallback();
    const onProgress = progress();
    const result = await insertProveedoresLote([
      proveedor(9, withRfc), first, duplicate, proveedor(2, withRfc), proveedor(9, withRfc),
    ], onProgress);
    expect(result.omitidos).toBe(3);
    expect(result.creados.map((row) => row.nombre)).toEqual(["PROVEEDOR 1", "PROVEEDOR 2"]);
    expect(transport.single.mock.calls.map(([row]) => row.nombre)).toEqual(["PROVEEDOR 1", "PROVEEDOR 2"]);
    expect(onProgress.mock.calls).toEqual([[1], [2]]);
  });

  it.each([1, 2, 4])("rechaza en la fila %s y conserva todas las altas previas confirmadas", async (failurePosition) => {
    failAt = failurePosition;
    fallback();
    const onProgress = progress();
    await expect(insertProveedoresLote(
      Array.from({ length: 5 }, (_, i) => proveedor(i + 1)), onProgress,
    )).rejects.toBe(rowFailure);
    expect(persisted).toHaveLength(failurePosition - 1);
    expect(transport.single).toHaveBeenCalledTimes(failurePosition);
    expect(onProgress.mock.calls).toEqual(Array.from({ length: failurePosition - 1 }, (_, i) => [i + 1]));
    expect(events.at(-1)).toBe(`single:PROVEEDOR ${failurePosition}`);
  });

  it("preserva la instancia Error y no convierte un fallo parcial en resultado exitoso", async () => {
    rowFailure = new Error("Causa original de la segunda fila");
    failAt = 2;
    fallback();
    const onProgress = progress();
    await expect(insertProveedoresLote([proveedor(1), proveedor(2)], onProgress)).rejects.toBe(rowFailure);
    expect(onProgress.mock.calls).toEqual([[1]]);
    expect(persisted).toHaveLength(1);
  });

  it("conserva ProveedorDuplicadoError y su contexto después de un alta", async () => {
    rowFailure = { code: "23505", message: "RFC concurrente" };
    transport.duplicate.mockResolvedValue({ data: { id: "existente", nombre: "OTRO PROVEEDOR" }, error: null });
    failAt = 2;
    fallback();
    const onProgress = progress();
    const failure = await insertProveedoresLote([proveedor(1), proveedor(2)], onProgress).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProveedorDuplicadoError);
    expect(failure).toMatchObject({
      existente: { id: "existente", nombre: "OTRO PROVEEDOR" }, rfcNormalizado: proveedor(2).rfc,
      message: "Ya existe un proveedor con este RFC: OTRO PROVEEDOR",
    });
    expect(onProgress.mock.calls).toEqual([[1]]);
    expect(persisted).toHaveLength(1);
    expect(transport.single).toHaveBeenCalledTimes(2);
  });

  it("suma el fallback de un segundo lote al primero sin duplicar conteos", async () => {
    transport.bulk.mockImplementationOnce(async (payload: ProveedorInsert[]) => ({ data: payload.map(confirm), error: null }));
    fallback();
    failAt = 2;
    const onProgress = progress();
    await expect(insertProveedoresLote(
      Array.from({ length: 203 }, (_, i) => proveedor(i + 1)), onProgress,
    )).rejects.toBe(rowFailure);
    expect(persisted).toHaveLength(201);
    expect(onProgress.mock.calls).toEqual([[200], [201]]);
    expect(transport.bulk).toHaveBeenCalledTimes(2);
    expect(transport.single).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])("reintenta sólo filas no confirmadas y reinicia conteos (RFC=%s)", async (withRfc) => {
    const rows = Array.from({ length: 4 }, (_, i) => proveedor(i + 1, withRfc));
    rows.splice(1, 0, { ...rows[0] });
    fallback();
    failAt = 3;
    const firstProgress = progress();
    await expect(insertProveedoresLote(rows, firstProgress)).rejects.toBe(rowFailure);
    expect(firstProgress.mock.calls).toEqual([[1], [2]]);
    expect(persisted).toHaveLength(2);
    failAt = 0;
    const retryProgress = progress();
    const result = await insertProveedoresLote(rows, retryProgress);
    expect(result.omitidos).toBe(3);
    expect(result.creados.map((row) => row.nombre)).toEqual(["PROVEEDOR 3", "PROVEEDOR 4"]);
    expect(retryProgress.mock.calls).toEqual([[1], [2]]);
    expect(persisted).toHaveLength(4);
    expect(new Set(persisted.map((row) => row.nombre)).size).toBe(4);
    const writes = transport.bulk.mock.calls.length;
    const finalProgress = progress();
    expect(await insertProveedoresLote(rows, finalProgress)).toEqual({ creados: [], omitidos: 5 });
    expect(transport.bulk).toHaveBeenCalledTimes(writes);
    expect(finalProgress).not.toHaveBeenCalled();
  });

  it("conserva el error de lote sin 23505 y el acumulado del lote anterior", async () => {
    transport.bulk.mockImplementationOnce(async (payload: ProveedorInsert[]) => ({ data: payload.map(confirm), error: null }));
    transport.bulk.mockResolvedValue({ data: null, error: { message: "Fallo de lote simulado" } });
    const onProgress = progress();
    await expect(insertProveedoresLote(
      Array.from({ length: 201 }, (_, i) => proveedor(i + 1)), onProgress,
    )).rejects.toThrow("Se importaron 200 de 201 proveedores; el siguiente lote falló: Fallo de lote simulado");
    expect(onProgress.mock.calls).toEqual([[200]]);
    expect(transport.single).not.toHaveBeenCalled();
  });

  it("no escribe ni reporta altas si falla la lectura previa de duplicados", async () => {
    transport.read.mockResolvedValue({ data: null, error: { message: "Fallo de lectura simulado" } });
    const onProgress = progress();
    await expect(insertProveedoresLote([proveedor(1)], onProgress)).rejects.toThrow("Fallo de lectura simulado");
    expect(transport.bulk).not.toHaveBeenCalled();
    expect(transport.single).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("mantiene validación del mapper y sólo importa payloads válidos", async () => {
    const preview = mapProveedorRows([
      { nombre: "Válido", tipo: "Naviera", email: "valido@example.invalid" },
      { nombre: "Sin tipo" }, { nombre: "Correo inválido", tipo: "Naviera", email: "incorrecto" },
    ], "org-test");
    expect(preview.invalid.map((row) => row.rowNumber)).toEqual([3, 4]);
    expect(preview.valid).toHaveLength(1);
    const result = await insertProveedoresLote(preview.valid.map((row) => row.payload));
    expect(result.creados).toHaveLength(1);
    expect(result.creados[0]).toMatchObject({ nombre: "VÁLIDO", tipo: "Naviera", organization_id: "org-test" });
  });

  it("no consulta ni escribe cuando no hay filas", async () => {
    const onProgress = progress();
    expect(await insertProveedoresLote([], onProgress)).toEqual({ creados: [], omitidos: 0 });
    expect(transport.from).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });
});
