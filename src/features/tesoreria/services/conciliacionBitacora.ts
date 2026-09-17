/**
 * Helper de bitácora para conciliación bancaria.
 * Extraído de `conciliacion.ts` para respetar el límite de 200 líneas.
 */
import { registrarActividad } from "@/services/bitacora/registrar";

export async function bitacoraImportarMovimientos(
  cuentaBancariaId: string,
  total: number,
  nuevos: number,
  duplicados: number,
  /**
   * MNY: filas que NO se guardaron por un fallo a media importación. Antes se
   * sumaban a `duplicados` y la bitácora reportaba duplicados inexistentes.
   */
  faltantes = 0,
): Promise<void> {
  await registrarActividad({
    modulo: "tesoreria",
    accion: "Importó movimientos bancarios",
    entidadId: cuentaBancariaId,
    detalles: { total, nuevos, duplicados, faltantes },
  });
}

export async function bitacoraConciliarMovimiento(
  movId: string,
  tipo: "cxc" | "cxp",
  pagoId: string,
): Promise<void> {
  await registrarActividad({
    modulo: "tesoreria",
    accion: "Concilió movimiento bancario",
    entidadId: movId,
    detalles: { tipo, pago_id: pagoId },
  });
}

export async function bitacoraDesconciliarMovimiento(movId: string): Promise<void> {
  await registrarActividad({
    modulo: "tesoreria",
    accion: "Desconcilió movimiento bancario",
    entidadId: movId,
  });
}

export async function bitacoraIgnorarMovimiento(movId: string, motivo: string): Promise<void> {
  await registrarActividad({
    modulo: "tesoreria",
    accion: "Ignoró movimiento bancario",
    entidadId: movId,
    detalles: { motivo },
  });
}
