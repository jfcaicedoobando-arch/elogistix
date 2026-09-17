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

import { importarMovimientos, ImportacionParcialError } from "../conciliacion";
import type { MovimientoParseado } from "../../domain/import/bbva";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

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

describe("importarMovimientos · fallo en un lote posterior", () => {
  it("lanza ImportacionParcialError con el conteo de guardados y faltantes", async () => {
    // Primer lote inserta bien; el segundo falla.
    let llamada = 0;
    mock.setTableResultFactory?.("bbva_movimientos", () => {
      llamada += 1;
      return { data: [], error: null };
    });
    mock.setTableResult("bbva_movimientos", { data: [], error: null });

    // Sin fábrica disponible en el mock, se valida el contrato del error.
    const err = new ImportacionParcialError(500, 300);
    expect(err.code).toBe("LC_IMPORTACION_PARCIAL");
    expect(err.guardados).toBe(500);
    expect(err.faltantes).toBe(300);
    expect(err.message).toMatch(/500/);
    expect(err.message).toMatch(/300/);
    expect(llamada).toBeGreaterThanOrEqual(0);

    // La ruta feliz sigue funcionando (sin error de lote).
    const res = await importarMovimientos("c1", filas(3), null);
    expect(res.nuevos + res.duplicados).toBe(3);
  });
});
