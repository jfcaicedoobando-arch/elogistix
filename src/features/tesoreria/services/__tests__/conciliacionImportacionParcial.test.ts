/**
 * MNY (item 8): si un lote de la importación bancaria falla a medias, los
 * movimientos ya guardados quedan en la base. El error debe decir cuántos
 * entraron y cuántos faltaron, en vez de parecer que no se importó nada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const registrarActividad = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...a: unknown[]) => registrarActividad(...a),
}));

import { importarMovimientos, ImportacionParcialError } from "../conciliacion";
import type { MovimientoParseado } from "../../domain/import/bbva";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  registrarActividad.mockClear();
});

/** 501 filas → dos lotes de inserción (CHUNK = 500). */
function filas(n: number): MovimientoParseado[] {
  return Array.from({ length: n }, (_, i) => ({
    fecha: "2026-06-10",
    concepto: `C${i}`,
    referencia: `R${i}`,
    cargo: 10,
    abono: 0,
    saldo: 0,
    hash_dedupe: `h${i}`,
  })) as unknown as MovimientoParseado[];
}

describe("importarMovimientos · fallo en el segundo lote", () => {
  it("lanza ImportacionParcialError con guardados y faltantes", async () => {
    // 1) dedupe lote 1, 2) dedupe lote 2 → nada existente
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    // 3) insert lote 1 OK (500 ids)
    mock.setTableResultOnce("bbva_movimientos", {
      data: Array.from({ length: 500 }, (_, i) => ({ id: `i${i}` })),
      error: null,
    });
    // 4) insert lote 2 falla
    mock.setTableResultOnce("bbva_movimientos", { data: null, error: { message: "boom insert" } });

    const err = await importarMovimientos("c1", filas(501), null).catch((e) => e);
    expect(err).toBeInstanceOf(ImportacionParcialError);
    expect((err as ImportacionParcialError).guardados).toBe(500);
    expect((err as ImportacionParcialError).faltantes).toBe(1);
    expect((err as ImportacionParcialError).code).toBe("LC_IMPORTACION_PARCIAL");
  });

  it("la ruta feliz devuelve el conteo completo", async () => {
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", {
      data: [{ id: "i1" }, { id: "i2" }, { id: "i3" }],
      error: null,
    });
    const res = await importarMovimientos("c1", filas(3), null);
    expect(res.nuevos).toBe(3);
    expect(res.duplicados).toBe(0);
  });
});

describe("importarMovimientos · bitácora con duplicados y fallo parcial", () => {
  it("no atribuye a duplicados las filas que quedaron pendientes", async () => {
    // 502 filas: 1 ya existía (duplicado real) → 501 nuevas en 2 lotes.
    mock.setTableResultOnce("bbva_movimientos", { data: [{ hash_dedupe: "h0" }], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", {
      data: Array.from({ length: 500 }, (_, i) => ({ id: `i${i}` })),
      error: null,
    });
    mock.setTableResultOnce("bbva_movimientos", { data: null, error: { message: "boom insert" } });

    const err = await importarMovimientos("c1", filas(502), null).catch((e) => e);
    expect(err).toBeInstanceOf(ImportacionParcialError);
    expect((err as ImportacionParcialError).guardados).toBe(500);
    expect((err as ImportacionParcialError).faltantes).toBe(1);

    expect(registrarActividad).toHaveBeenCalledTimes(1);
    expect(registrarActividad.mock.calls[0][0]).toMatchObject({
      detalles: { total: 502, nuevos: 500, duplicados: 1, faltantes: 1 },
    });
  });
});
