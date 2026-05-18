import type { CotizacionRow } from '@/types/cotizacion';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { escapeHtml as esc } from '@/lib/utils';
import type { ConceptosTotales } from './conceptosTables';

export const pdfStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f4c81; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #0f4c81; }
  .header .meta { text-align: right; font-size: 12px; color: #555; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #e0e7ff; color: #3730a3; }
  section { margin-bottom: 20px; }
  h3 { font-size: 14px; color: #0f4c81; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
  h4 { font-size: 13px; color: #333; margin: 10px 0 6px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 16px; }
  .cell { display: flex; flex-direction: column; }
  .label { font-size: 11px; color: #777; }
  .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
  th { background: #f0f4f8; font-weight: 600; color: #333; }
  .right { text-align: right; }
  .totals { text-align: right; margin-top: 6px; font-weight: 600; font-size: 12px; }
  .subtotal { text-align: right; margin-top: 10px; font-size: 15px; font-weight: 700; color: #0f4c81; }
  .resumen { margin-top: 20px; padding: 12px; border: 2px solid #0f4c81; border-radius: 8px; text-align: right; }
  .resumen p { font-size: 14px; font-weight: 700; color: #0f4c81; margin: 4px 0; }
  .resumen .nota { font-size: 11px; color: #777; font-weight: 400; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #999; text-align: center; }
  .page-break { page-break-before: always; }
  @media print { body { padding: 16px; } }
`;

export function buildHeaderHtml(c: CotizacionRow): string {
  const nombre = c.es_prospecto ? `${c.prospecto_empresa} (Prospecto)` : c.cliente_nombre;
  return `
  <div class="header">
    <div>
      <h1>${esc(c.folio)}</h1>
      <p style="margin-top:4px">${esc(nombre)}</p>
    </div>
    <div class="meta">
      <span class="badge">${esc(c.estado)}</span>
      <p style="margin-top:6px">Fecha: ${formatDate(c.created_at.substring(0, 10))}</p>
    </div>
  </div>`;
}

export function buildProspectoHtml(c: CotizacionRow): string {
  if (!c.es_prospecto) return '';
  return `<section>
    <h3>Datos del Prospecto</h3>
    <div class="grid">
      <div class="cell"><span class="label">Empresa</span><span class="value">${esc(c.prospecto_empresa)}</span></div>
      <div class="cell"><span class="label">Contacto</span><span class="value">${esc(c.prospecto_contacto)}</span></div>
      <div class="cell"><span class="label">Email</span><span class="value">${esc(c.prospecto_email || '-')}</span></div>
      <div class="cell"><span class="label">Teléfono</span><span class="value">${esc(c.prospecto_telefono || '-')}</span></div>
    </div>
  </section>`;
}

export function buildResumenHtml(t: ConceptosTotales, hayMxn: boolean): string {
  return `<div class="resumen">
      <p>Subtotal USD: ${formatCurrency(t.subtotalUSD, 'USD')}</p>
      ${t.ivaUSD > 0 ? `<p>IVA (16%): ${formatCurrency(t.ivaUSD, 'USD')}</p>` : ''}
      <p><strong>Total USD: ${formatCurrency(t.totalUSD, 'USD')}</strong></p>
      ${hayMxn ? `
      <p style="margin-top:8px">Subtotal MXN: ${formatCurrency(t.subtotalMXN, 'MXN')}</p>
      <p>IVA (16%): ${formatCurrency(t.ivaMXN, 'MXN')}</p>
      <p><strong>Total MXN: ${formatCurrency(t.totalMXN, 'MXN')}</strong></p>` : ''}
      <p class="nota">* Los cargos en destino incluyen IVA</p>
    </div>`;
}

export function buildFooterHtml(): string {
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<div class="footer">Documento generado el ${fecha} — Libre Carga</div>`;
}
