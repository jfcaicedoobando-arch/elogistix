/**
 * MNY P1.1 — doble contabilización al importar el estado de cuenta después de
 * registrar un cobro con cuenta bancaria.
 *
 * El cobro crea un movimiento espejo (`cobro-<pago_id>`). Al importar la línea
 * real del banco, la RPC `absorber_espejos_importacion` hace que esa línea
 * SUSTITUYA al espejo (conservando el vínculo con el pago y los datos del
 * archivo), así el saldo cuenta la operación UNA sola vez y la conciliación
 * sigue siendo posible. Re-importar el archivo no agrega nada.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn().mockResolvedValue(undefined),
}));

import { importarMovimientos } from "../conciliacion";
import type { MovimientoParseado } from "../../domain/import/bbva";

const FILA: MovimientoParseado = {
  fecha: "2026-06-10",
  concepto: "DEPOSITO CLIENTE",
  referencia: "REF-1",
  cargo: 0,
  abono: 10000,
  saldo: 10000,
  hash_dedupe: "hash-archivo",
} as unknown as MovimientoParseado;

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("importarMovimientos · espejo de cobro", () => {
  it("pide absorber los espejos antes de deduplicar, con las filas del archivo", async () => {
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [{ id: "m1" }], error: null });

    await importarMovimientos("cta-1", [FILA], "u1");

    const llamada = mock.rpcCalls.find((r) => r.fn === "absorber_espejos_importacion");
    expect(llamada).toBeTruthy();
    const args = llamada?.args as { p_cuenta_bancaria_id: string; p_filas: unknown[] };
    expect(args.p_cuenta_bancaria_id).toBe("cta-1");
    expect(args.p_filas).toHaveLength(1);
    expect((args.p_filas[0] as { hash_dedupe: string }).hash_dedupe).toBe("hash-archivo");
  });

  it("no inserta nada cuando el espejo absorbió la línea (saldo contado una vez)", async () => {
    // Tras la absorción, el hash del archivo ya existe vivo en la cuenta.
    mock.setTableResultOnce("bbva_movimientos", {
      data: [{ hash_dedupe: "hash-archivo" }],
      error: null,
    });

    const res = await importarMovimientos("cta-1", [FILA], "u1");

    expect(res).toEqual({ total: 1, nuevos: 0, duplicados: 1 });
    const inserts = mock.tableCalls.filter(
      (c) => c.table === "bbva_movimientos" && c.ops.includes("insert"),
    );
    expect(inserts).toHaveLength(0);
  });

  it("re-importar el mismo archivo sigue siendo idempotente", async () => {
    mock.setTableResult("bbva_movimientos", {
      data: [{ hash_dedupe: "hash-archivo" }],
      error: null,
    });

    const a = await importarMovimientos("cta-1", [FILA], "u1");
    const b = await importarMovimientos("cta-1", [FILA], "u1");

    expect(a.nuevos).toBe(0);
    expect(b.nuevos).toBe(0);
    expect(b.duplicados).toBe(1);
  });
});
