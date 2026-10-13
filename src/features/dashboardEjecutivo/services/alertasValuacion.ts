import type { AlertaEjecutiva, SnapshotEjecutivo } from './types';
import { formatCurrency } from '@/lib/formatters';

export function presupuestoIncompleto(presupuesto: SnapshotEjecutivo['presupuesto']): boolean {
  return presupuesto.real_truncado === true || presupuesto.gastos_sin_tc_count > 0;
}

export function alertasValuacion({tesoreria, presupuesto}: Pick<SnapshotEjecutivo, 'tesoreria' | 'presupuesto'>): AlertaEjecutiva[] {
  const alertas: AlertaEjecutiva[] = [];
  if (tesoreria.saldo_bancos_incompleto) {
    const excluidos = (tesoreria.saldos_monedas_excluidas ?? []).map((moneda) => formatCurrency(tesoreria.saldos_por_moneda?.[moneda] ?? 0, moneda)).join(', ');
    alertas.push({id:'bancos-valuacion-incompleta', severidad:'warning', titulo:'Saldo bancario parcial', descripcion:`Sin TC para ${excluidos || 'algunas monedas'}. Runway no disponible.`, url:'/tesoreria'});
  }
  if (presupuestoIncompleto(presupuesto)) {
    alertas.push({id:'presupuesto-real-incompleto', severidad:'warning', titulo:'Gasto real incompleto', descripcion:`${presupuesto.gastos_sin_tc_count ?? 0} gasto(s) sin TC. ${presupuesto.real_truncado ? 'La consulta alcanzó su límite de filas.' : ''} Cumplimiento no disponible.`, url:'/profit/presupuesto?tab=vs-real'});
  }
  return alertas;
}
