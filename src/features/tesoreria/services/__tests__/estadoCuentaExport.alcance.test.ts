import { describe, expect, it } from "vitest";
import { alcanceEstadoCuentaExport, filasEstadoCuentaExport, resumenEstadoCuenta } from "../estadoCuentaExport";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta } from "../../domain/estadoCuenta";

const movimiento = (id: string, cargo: number, abono: number, saldo_corrido: number): MovimientoEstadoCuenta => ({ id, cargo, abono, saldo_corrido, fecha: "2026-09-30", concepto: id, referencia: id, estado_conciliacion: "Pendiente", pago_factura_id: null, pago_proveedor_id: null, anticipo_proveedor_id: null, pago_proveedor_lote_id: null });
const salida = movimiento("FP", 100, 0, 900);
const entrada = movimiento("A1", 0, 116, 1016);
const estado: EstadoCuentaBancario = { cuenta_id: "fixture", alias: "Cuenta sintética", banco: "Banco", moneda: "MXN", desde: "2026-09-01", desde_solicitado: "2026-09-01", cobertura_historica: "completa", hasta: "2026-09-30", saldo_inicial: 1000, total_entradas: 116, total_salidas: 100, saldo_final: 1016, fecha_saldo_inicial: null, movimientos_previos_corte: 0, movimientos: [salida, entrada] };

describe("Exportación bancaria - tabla filtrada y periodo", () => {
  it("exporta A1 uno de dos con entradas visibles y conserva salidas y saldo reales en el resumen", () => {
    expect(alcanceEstadoCuentaExport(estado, [entrada], { texto: " A1 ", tipo: "entradas" })).toEqual({ filtro: "Búsqueda: A1 | Tipo: entradas", movimientosVisibles: 1, movimientosPeriodo: 2, entradas: "MXN 116.00", salidas: "MXN 0.00" });
    expect(resumenEstadoCuenta(estado)).toMatchObject({ salidas: "MXN 100.00", saldoFinal: "MXN 1,016.00" });
    expect(filasEstadoCuentaExport([entrada], "MXN")[0].saldo).toBe("MXN 1,016.00");
  });

  it("identifica el alcance completo sin filtros", () => {
    expect(alcanceEstadoCuentaExport(estado, estado.movimientos, { texto: "", tipo: "todos" })).toMatchObject({ filtro: "Sin filtros de búsqueda o tipo", movimientosVisibles: 2, movimientosPeriodo: 2, salidas: "MXN 100.00" });
  });
});
