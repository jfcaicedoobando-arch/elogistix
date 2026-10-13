import type { EstadoResultados, ModoColumna } from './estadoResultados';

export interface ExclusionTcER {
  embarque_id: string;
  concepto: string;
  moneda: string;
  nominal: number;
  seccion: 'ingresos' | 'costos';
  modo: ModoColumna;
}

export interface ValuacionER {
  completa: boolean;
  conceptos_sin_tc_count: number;
  /** Nominales firmados, nunca sumados entre monedas ni convertidos sin TC. */
  excluidos_sin_tc: ExclusionTcER[];
}

export function valuacionIncompleta(data: EstadoResultados): boolean {
  return data.valuacion?.completa === false;
}

export function exigirValuacionCompleta(data: EstadoResultados): void {
  if (valuacionIncompleta(data)) {
    throw new Error('Valuación incompleta: captura los tipos de cambio faltantes antes de exportar el Estado de Resultados.');
  }
}

export function avisoValuacion(data: EstadoResultados): string | null {
  if (!valuacionIncompleta(data)) return null;
  return `Valuación incompleta: ${data.valuacion?.conceptos_sin_tc_count} concepto(s) sin tipo de cambio. Los ingresos y costos mostrados son parciales; utilidad y margen no disponibles. Completa los tipos de cambio para exportar.`;
}

export function puedeExportarEerr(data: EstadoResultados | undefined): data is EstadoResultados {
  return !!data && !valuacionIncompleta(data);
}

export function sinMovimientosEerr(data: EstadoResultados | undefined): boolean {
  return !!data && !valuacionIncompleta(data) && data.ingresos.length === 0 && data.costos.length === 0;
}
