import { formatCurrency } from '@/lib/formatters';
import { escapeHtml as esc } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { buildProformaPdfStyles, openPdfWindow, formatearDescripcionConcepto } from './styles';
import { buildProformaHeaderHtml, type EmbarqueLite, type ClienteLite } from './header';

type ProformaRow = Tables<'proformas'>;
type ConceptoConsolidado = Tables<'proforma_conceptos_consolidados'>;

interface Grupo { contenedor: string; tipo: string | null; items: ConceptoConsolidado[]; }

function agruparPorContenedor(conceptos: ConceptoConsolidado[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const c of conceptos) {
    const key = `${c.contenedor ?? 'Sin contenedor'}|${c.tipo_contenedor ?? ''}`;
    if (!map.has(key)) {
      map.set(key, { contenedor: c.contenedor ?? 'Sin contenedor', tipo: c.tipo_contenedor, items: [] });
    }
    map.get(key)!.items.push(c);
  }
  return Array.from(map.values());
}

function renderGrupoTabla(grupo: Grupo, moneda: 'USD' | 'MXN'): string {
  const items = grupo.items.filter(i => i.moneda === moneda);
  if (items.length === 0) return '';
  const hayIva = items.some(i => i.aplica_iva);
  const headerCols = hayIva
    ? `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th><th class="right">IVA</th>`
    : `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th>`;
  const rows = items.map(i => {
    const sub = Number(i.total);
    const base = `<td>${esc(formatearDescripcionConcepto(i.descripcion))}</td><td class="right">${i.cantidad}</td><td class="right">${formatCurrency(Number(i.precio_unitario), moneda)}</td><td class="right">${formatCurrency(sub, moneda)}</td>`;
    return hayIva
      ? `<tr>${base}<td class="right">${i.aplica_iva ? formatCurrency(Number(i.iva), moneda) : '—'}</td></tr>`
      : `<tr>${base}</tr>`;
  }).join('');
  const subContenedor = items.reduce((s, i) => s + Number(i.total), 0);
  return `
    <table>
      <thead><tr>${headerCols}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="container-subtotal">Subtotal ${moneda}: <strong>${formatCurrency(subContenedor, moneda)}</strong></div>`;
}

function renderSeccionMoneda(grupos: Grupo[], proforma: ProformaRow, moneda: 'USD' | 'MXN', conceptos: ConceptoConsolidado[]): string {
  const tiene = conceptos.some(c => c.moneda === moneda);
  if (!tiene) return '';
  const subtotal = moneda === 'USD' ? proforma.subtotal_usd : proforma.subtotal_mxn;
  const iva = moneda === 'USD' ? proforma.iva_usd : proforma.iva_mxn;
  const total = moneda === 'USD' ? proforma.total_usd : proforma.total_mxn;
  return `
    <h4>Conceptos en ${moneda}</h4>
    ${grupos.map(g => `
      <div class="container-block">📦 Contenedor: ${esc(g.contenedor)}${g.tipo ? ` (${esc(g.tipo)})` : ''}</div>
      ${renderGrupoTabla(g, moneda)}
    `).join('')}
    <div class="subtotal-block">
      <p>Subtotal ${moneda}: <strong>${formatCurrency(Number(subtotal), moneda)}</strong></p>
      ${Number(iva) > 0 ? `<p>IVA ${moneda}: <strong>${formatCurrency(Number(iva), moneda)}</strong></p>` : ''}
      <p class="total-line">Total ${moneda}: <strong>${formatCurrency(Number(total), moneda)}</strong></p>
    </div>`;
}

export function generarPdfConsolidada(params: {
  proforma: ProformaRow;
  embarque: EmbarqueLite;
  cliente: ClienteLite;
  conceptosConsolidados: ConceptoConsolidado[];
}): void {
  const { proforma, embarque, cliente, conceptosConsolidados } = params;
  const grupos = agruparPorContenedor(conceptosConsolidados);

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(proforma.numero)} - Proforma Consolidada</title>
${buildProformaPdfStyles()}</head><body>
  ${buildProformaHeaderHtml(proforma, cliente, embarque, true)}

  <section>
    <h3>Conceptos por Contenedor</h3>
    ${renderSeccionMoneda(grupos, proforma, 'USD', conceptosConsolidados)}
    ${renderSeccionMoneda(grupos, proforma, 'MXN', conceptosConsolidados)}
  </section>

  ${proforma.notas ? `<section><h3>Notas</h3><p>${esc(proforma.notas)}</p></section>` : ''}

  <div class="footer-aviso">
    ⚠ Este documento es una proforma consolidada y no tiene validez fiscal
  </div>

  <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Libre Carga</div>
</body></html>`;

  openPdfWindow(html);
}
