/**
 * Lógica pura: agrupación semanal de facturas de proveedor para la bandeja
 * de "Pagos programados" de Tesorería (QW7).
 *
 * Regla de fecha efectiva idéntica a QW1 (`flujoProyectado.ts`):
 * `COALESCE(fecha_programada_pago, fecha_vencimiento)`.
 */
import { parseDateOnlyLocal, formatDateOnlyLocal } from "@/lib/date/dateOnly";
import { inicioSemana, isoWeekKey } from "./flujoProyectado";

export interface FacturaProgramable {
  id: string;
  proveedor_nombre: string | null;
  folio_proveedor: string | null;
  fecha_vencimiento: string | null;
  fecha_programada_pago: string | null;
  moneda: string;
  total: number;
  saldo: number;
}

export interface SemanaPagosProgramados {
  semanaKey: string;
  semanaInicio: string;
  semanaFin: string;
  facturas: FacturaProgramable[];
  totalesPorMoneda: Record<string, number>;
}

/** Fecha efectiva de salida: programada si existe, si no vencimiento. */
export function fechaEfectivaPago(f: FacturaProgramable): string | null {
  return f.fecha_programada_pago ?? f.fecha_vencimiento;
}

/**
 * Agrupa facturas por semana ISO según su fecha efectiva de pago. Facturas
 * sin fecha (ni programada ni vencimiento) se omiten del resultado.
 * Semanas ordenadas cronológicamente ascendente.
 */
export function agruparPorSemana(
  facturas: readonly FacturaProgramable[],
): SemanaPagosProgramados[] {
  const map = new Map<string, SemanaPagosProgramados>();

  for (const f of facturas) {
    const fecha = fechaEfectivaPago(f);
    if (!fecha) continue;
    const d = parseDateOnlyLocal(fecha);
    const key = isoWeekKey(d);
    let semana = map.get(key);
    if (!semana) {
      const inicio = inicioSemana(d);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      semana = {
        semanaKey: key,
        semanaInicio: formatDateOnlyLocal(inicio),
        semanaFin: formatDateOnlyLocal(fin),
        facturas: [],
        totalesPorMoneda: {},
      };
      map.set(key, semana);
    }
    semana.facturas.push(f);
    semana.totalesPorMoneda[f.moneda] = (semana.totalesPorMoneda[f.moneda] ?? 0) + f.saldo;
  }

  return Array.from(map.values()).sort((a, b) => a.semanaInicio.localeCompare(b.semanaInicio));
}
