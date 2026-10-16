import { presupuestoIncompleto } from "./alertasValuacion";
import type { SnapshotEjecutivo } from './types';

type Base = Pick<SnapshotEjecutivo, 'eerrPeriodo' | 'tesoreria' | 'presupuesto' | 'vencimientos'>;
export function completitudEjecutiva(snapshot: Base) {
  return {
    saldo_bancos_incompleto: snapshot.tesoreria.saldo_bancos_incompleto === true,
    cartera_vencida_incompleta: Object.keys(snapshot.vencimientos.cobranzaMayor30.excluido_por_moneda).length > 0,
    cxp_7dias_incompleto: Object.keys(snapshot.vencimientos.cxpProximos7.excluido_por_moneda).length > 0,
    presupuesto_incompleto: presupuestoIncompleto(snapshot.presupuesto),
    eerr_incompleto: snapshot.eerrPeriodo.valuacion?.completa === false,
    flujo_incompleto: snapshot.tesoreria.flujo.flujo_incompleto === true,
    tiene_presupuesto: snapshot.presupuesto.total_presupuesto_mxn > 0,
  };
}

export function sinVariacionesIncompletas(
  kpis: SnapshotEjecutivo['kpis'], actual: SnapshotEjecutivo['eerrPeriodo'], previo?: SnapshotEjecutivo['eerrPeriodo'],
): SnapshotEjecutivo['kpis'] {
  if (actual.valuacion?.completa === false || previo?.valuacion?.completa === false) {
    return {...kpis, ingresos_delta_pct: null, utilidad_delta_pct: null, margen_delta_puntos: null};
  }
  return kpis;
}
