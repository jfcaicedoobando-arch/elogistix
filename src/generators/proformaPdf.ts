import { calcularIVA, TASA_IVA } from '@/lib/financial/financialUtils';
import { formatCurrency } from '@/lib/formatters';
import { escapeHtml as esc } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { buildProformaPdfStyles, openPdfWindow, formatearDescripcionConcepto } from './proforma/styles';
import { buildProformaHeaderHtml, type EmbarqueLite, type ClienteLite } from './proforma/header';
import { generarPdfConsolidada } from './proforma/consolidada';

type ProformaRow = Tables<'proformas'>;
type ConceptoVenta = Tables<'conceptos_venta'>;
type ConceptoConsolidado = Tables<'proforma_conceptos_consolidados'>;

interface GenerarPdfProformaParams {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  conceptos: ConceptoVenta[];
  cliente?: ClienteLite;
  tasaIva?: number;
  conceptosConsolidados?: ConceptoConsolidado[];
}

function buildUsdTable(conceptosUSD: ConceptoVenta[], proforma: ProformaRow, tasaIva: number): string {
  if (conceptosUSD.length === 0) return '';
  const hayIva = conceptosUSD.some(c => c.aplica_iva);
  const headerCols = hayIva
    ? `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th><th class="right">IVA</th>`
    : `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th>`;
  const rows = conceptosUSD.map(c => {
    const sub = Number(c.cantidad) * Number(c.precio_unitario);
    const base = `<td>${esc(formatearDescripcionConcepto(c.descripcion))}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td>`;
    if (!hayIva) return `<tr>${base}</tr>`;
    const iva = c.aplica_iva ? calcularIVA(sub, tasaIva) : 0;
    return `<tr>${base}<td class="right">${c.aplica_iva ? formatCurrency(iva, 'USD') : '—'}</td></tr>`;
  }).join('');
  return `
    <h4>Conceptos en USD</h4>
    <table>
      <thead><tr>${headerCols}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="subtotal-block">
      <p>Subtotal USD: <strong>${formatCurrency(Number(proforma.subtotal_usd), 'USD')}</strong></p>
      ${Number(proforma.iva_usd) > 0 ? `<p>IVA USD: <strong>${formatCurrency(Number(proforma.iva_usd), 'USD')}</strong></p>` : ''}
      <p class="total-line">Total USD: <strong>${formatCurrency(Number(proforma.total_usd), 'USD')}</strong></p>
    </div>`;
}

function buildMxnTable(conceptosMXN: ConceptoVenta[], proforma: ProformaRow, tasaIva: number): string {
  if (conceptosMXN.length === 0) return '';
  const rows = conceptosMXN.map(c => {
    const sub = Number(c.cantidad) * Number(c.precio_unitario);
    return `<tr><td>${esc(formatearDescripcionConcepto(c.descripcion))}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'MXN')}</td><td class="right">${formatCurrency(sub, 'MXN')}</td></tr>`;
  }).join('');
  return `
    <h4>Conceptos en MXN</h4>
    <table>
      <thead><tr><th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="subtotal-block">
      <p>Subtotal MXN: <strong>${formatCurrency(Number(proforma.subtotal_mxn), 'MXN')}</strong></p>
      <p>IVA ${(tasaIva * 100).toFixed(0)}%: <strong>${formatCurrency(Number(proforma.iva_mxn), 'MXN')}</strong></p>
      <p class="total-line">Total MXN: <strong>${formatCurrency(Number(proforma.total_mxn), 'MXN')}</strong></p>
    </div>`;
}

export function generarPdfProforma(params: GenerarPdfProformaParams): void {
  if (params.proforma.es_consolidada && params.conceptosConsolidados && params.conceptosConsolidados.length > 0) {
    return generarPdfConsolidada({
      proforma: params.proforma,
      embarque: params.embarque,
      cliente: params.cliente,
      conceptosConsolidados: params.conceptosConsolidados,
    });
  }

  const { proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA } = params;
  const conceptosUSD = conceptos.filter(c => c.moneda === 'USD');
  const conceptosMXN = conceptos.filter(c => c.moneda === 'MXN');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(proforma.numero)} - Proforma</title>
${buildProformaPdfStyles()}</head><body>
  ${buildProformaHeaderHtml(proforma, cliente, embarque, false)}

  <section>
    <h3>Conceptos</h3>
    ${buildUsdTable(conceptosUSD, proforma, tasaIva)}
    ${buildMxnTable(conceptosMXN, proforma, tasaIva)}
  </section>

  ${proforma.notas ? `<section><h3>Notas</h3><p>${esc(proforma.notas)}</p></section>` : ''}

  <div class="footer-aviso">
    ⚠ Este documento es una proforma y no tiene validez fiscal
  </div>

  <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Libre Carga</div>
</body></html>`;

  openPdfWindow(html);
}
