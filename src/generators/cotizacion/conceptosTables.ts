import type { ConceptoVentaCotizacion } from '@/types/cotizacion';
import { calcularIVA } from '@/lib/financial/financialUtils';
import { formatCurrency } from '@/lib/formatters';
import { escapeHtml as esc } from '@/lib/utils';

export interface ConceptosTotales {
  subtotalUSD: number;
  ivaUSD: number;
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

export function splitConceptos(conceptos: ConceptoVentaCotizacion[]) {
  const usd = conceptos.filter((c) => c.moneda === 'USD');
  const mxn = conceptos.filter((c) => c.moneda === 'MXN');
  return { usd, mxn };
}

export function calcularTotales(conceptos: ConceptoVentaCotizacion[]): ConceptosTotales {
  const { usd, mxn } = splitConceptos(conceptos);
  const subtotalUSD = usd.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaUSD = usd.reduce((s, c) => (c.aplica_iva ? s + calcularIVA(c.cantidad * c.precio_unitario) : s), 0);
  const subtotalMXN = mxn.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaMXN = calcularIVA(subtotalMXN);
  return {
    subtotalUSD,
    ivaUSD,
    totalUSD: subtotalUSD + ivaUSD,
    subtotalMXN,
    ivaMXN,
    totalMXN: subtotalMXN + ivaMXN,
  };
}

function rowUsdSinIva(c: ConceptoVentaCotizacion): string {
  const sub = c.cantidad * c.precio_unitario;
  const unidad = c.unidad_medida || '—';
  const nota = c.notas
    ? `<tr><td colspan="5" style="border-top:none;padding-top:0;font-size:11px;color:#888;font-style:italic">↳ ${esc(c.notas)}</td></tr>`
    : '';
  return `<tr><td>${esc(c.descripcion)}</td><td>${esc(unidad)}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(c.precio_unitario, 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td></tr>${nota}`;
}

function rowUsdConIva(c: ConceptoVentaCotizacion, tasaIva: number): string {
  const sub = c.cantidad * c.precio_unitario;
  const unidad = c.unidad_medida || '—';
  const iva = c.aplica_iva ? calcularIVA(sub, tasaIva) : 0;
  const total = sub + iva;
  const desc = c.aplica_iva
    ? `${esc(c.descripcion)} <span style='color:#999;font-size:11px'>(+IVA ${tasaIva * 100}%)</span>`
    : esc(c.descripcion);
  const nota = c.notas
    ? `<tr><td colspan="7" style="border-top:none;padding-top:0;font-size:11px;color:#888;font-style:italic">↳ ${esc(c.notas)}</td></tr>`
    : '';
  return `<tr><td>${desc}</td><td>${esc(unidad)}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(c.precio_unitario, 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td><td class="right">${c.aplica_iva ? formatCurrency(iva, 'USD') : '—'}</td><td class="right">${formatCurrency(total, 'USD')}</td></tr>${nota}`;
}

export function buildUsdTable(conceptos: ConceptoVentaCotizacion[], totalUSD: number, tasaIva: number): string {
  if (conceptos.length === 0) return '';
  const hayIva = conceptos.some((c) => c.aplica_iva);
  const header = hayIva
    ? `<th>Descripción</th><th>Unidad</th><th class="right">Cantidad</th><th class="right">Precio Unitario</th><th class="right">Subtotal</th><th class="right">IVA (${tasaIva * 100}%)</th><th class="right">Total</th>`
    : '<th>Descripción</th><th>Unidad</th><th class="right">Cantidad</th><th class="right">Precio Unitario</th><th class="right">Total</th>';
  const rows = conceptos.map((c) => (hayIva ? rowUsdConIva(c, tasaIva) : rowUsdSinIva(c))).join('');
  return `
      <h4>Conceptos en USD</h4>
      <table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
      <p class="subtotal">Total USD: ${formatCurrency(totalUSD, 'USD')}</p>`;
}

export function buildMxnTable(
  conceptos: ConceptoVentaCotizacion[],
  totales: ConceptosTotales,
  tasaIva: number,
): string {
  if (conceptos.length === 0) return '';
  const rows = conceptos
    .map((c) => {
      const sub = c.cantidad * c.precio_unitario;
      const iva = calcularIVA(sub, tasaIva);
      const unidad = c.unidad_medida || '—';
      const nota = c.notas
        ? `<tr><td colspan="7" style="border-top:none;padding-top:0;font-size:11px;color:#888;font-style:italic">↳ ${esc(c.notas)}</td></tr>`
        : '';
      return `<tr><td>${esc(c.descripcion)}</td><td>${esc(unidad)}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(c.precio_unitario, 'MXN')}</td><td class="right">${formatCurrency(sub, 'MXN')}</td><td class="right">${formatCurrency(iva, 'MXN')}</td><td class="right">${formatCurrency(sub + iva, 'MXN')}</td></tr>${nota}`;
    })
    .join('');
  return `
      <h4>Conceptos en MXN + IVA</h4>
      <table><thead><tr><th>Descripción</th><th>Unidad</th><th class="right">Cantidad</th><th class="right">P. Unitario</th><th class="right">Subtotal</th><th class="right">IVA (${tasaIva * 100}%)</th><th class="right">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="totals">Subtotal MXN: ${formatCurrency(totales.subtotalMXN, 'MXN')} &nbsp;|&nbsp; IVA: ${formatCurrency(totales.ivaMXN, 'MXN')}</p>
      <p class="subtotal">Total MXN: ${formatCurrency(totales.totalMXN, 'MXN')}</p>`;
}
