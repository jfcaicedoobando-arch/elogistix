import type { CotizacionRow } from '@/types/cotizacion';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { escapeHtml as esc } from '@/lib/utils';

function rowsMaritimo(c: CotizacionRow): [string, string][] {
  if (c.modo !== 'Marítimo') return [];
  const out: [string, string][] = [];
  if (c.tipo_embarque === 'FCL') {
    if (c.dias_libres_destino > 0) out.push(['Días libres en destino', `${c.dias_libres_destino} días`]);
    out.push(['Carta garantía', c.carta_garantia ? 'Sí' : 'No']);
  }
  if (c.tipo_embarque === 'LCL' && c.dias_almacenaje > 0) {
    out.push(['Días libres de almacenaje', `${c.dias_almacenaje} días`]);
  }
  return out;
}

function rowsOpcionales(c: CotizacionRow): [string, string][] {
  const out: [string, string][] = [];
  if (c.tiempo_transito_dias != null) out.push(['Tiempo de tránsito', `${c.tiempo_transito_dias} días`]);
  if (c.frecuencia) out.push(['Frecuencia', c.frecuencia]);
  if (c.ruta_texto) out.push(['Ruta', c.ruta_texto]);
  if (c.tipo_movimiento) out.push(['Tipo de movimiento', c.tipo_movimiento]);
  return out;
}

export function buildDatosGenerales(c: CotizacionRow): [string, string][] {
  const base: [string, string][] = [
    ['Modo', c.modo],
    ['Tipo', c.tipo],
    ['Incoterm', c.incoterm],
    ['Origen', c.origen || '-'],
    ['Destino', c.destino || '-'],
    ['Vigencia', `${c.vigencia_dias} días${c.fecha_vigencia ? ` (${formatDate(c.fecha_vigencia)})` : ''}`],
    ['Operador', c.operador || '-'],
  ];
  const seguro: [string, string] = [
    'Seguro',
    c.seguro ? `Sí — ${formatCurrency(Number(c.valor_seguro_usd || 0), 'USD')}` : 'No',
  ];
  return [...base, ...rowsOpcionales(c), ...rowsMaritimo(c), seguro];
}

export function buildMercancia(c: CotizacionRow): [string, string][] {
  const esMaritimo = c.modo === 'Marítimo';
  const esAereo = c.modo === 'Aéreo';
  const m: [string, string][] = [];
  if (esMaritimo) m.push(['Tipo de Embarque', c.tipo_embarque]);
  if (esMaritimo && c.tipo_embarque === 'FCL') {
    m.push(['Tipo de Contenedor', c.tipo_contenedor || '-']);
    m.push(['Peso', c.tipo_peso]);
  }
  m.push(['Tipo de Carga', c.tipo_carga || 'Carga General']);
  m.push(['Sector Económico', c.sector_economico || c.descripcion_mercancia || '-']);
  if (!esMaritimo && !esAereo) {
    m.push(['Peso', `${c.peso_kg} kg`]);
    m.push(['Volumen', `${c.volumen_m3} m³`]);
    m.push(['Piezas', `${c.piezas}`]);
  }
  return m;
}

export function gridCellsHtml(items: [string, string][]): string {
  return items
    .map(([l, v]) => `<div class="cell"><span class="label">${esc(l)}</span><span class="value">${esc(v)}</span></div>`)
    .join('');
}
