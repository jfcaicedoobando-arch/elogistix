import { calcularIVA, TASA_IVA } from '@/lib/financialUtils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type ProformaRow = Tables<'proformas'>;
type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;

interface GenerarPdfProformaParams {
  proforma: ProformaRow;
  embarque: Pick<EmbarqueRow, 'expediente' | 'bl_master' | 'modo' | 'tipo' | 'incoterm' | 'puerto_origen' | 'puerto_destino' | 'aeropuerto_origen' | 'aeropuerto_destino' | 'ciudad_origen' | 'ciudad_destino' | 'naviera' | 'aerolinea' | 'descripcion_mercancia'>;
  conceptos: ConceptoVenta[];
  tasaIva?: number;
}

export function generarPdfProforma({ proforma, embarque, conceptos, tasaIva = TASA_IVA }: GenerarPdfProformaParams) {
  const conceptosUSD = conceptos.filter(c => c.moneda === 'USD');
  const conceptosMXN = conceptos.filter(c => c.moneda === 'MXN');

  const origen = embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || '-';
  const destino = embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || '-';
  const transporte = embarque.naviera || embarque.aerolinea || '-';

  const datosGenerales: [string, string][] = [
    ['Expediente', embarque.expediente],
    ['BL/MAWB', embarque.bl_master || '-'],
    ['Modo', embarque.modo],
    ['Tipo', embarque.tipo],
    ['Incoterm', embarque.incoterm],
    ['Origen', origen],
    ['Destino', destino],
    ['Transportista', transporte],
  ];

  const gridCells = (items: [string, string][]) => items.map(
    ([label, value]) => `<div class="cell"><span class="label">${label}</span><span class="value">${value}</span></div>`
  ).join('');

  const buildUsdTable = () => {
    if (conceptosUSD.length === 0) return '';
    const hayIva = conceptosUSD.some(c => c.aplica_iva);
    const headerCols = hayIva
      ? `<th>Descripción</th><th class="right">Cantidad</th><th class="right">P. Unitario</th><th class="right">Subtotal</th><th class="right">IVA</th><th class="right">Total</th>`
      : `<th>Descripción</th><th class="right">Cantidad</th><th class="right">P. Unitario</th><th class="right">Total</th>`;
    const rows = conceptosUSD.map(c => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      if (hayIva) {
        const iva = c.aplica_iva ? calcularIVA(sub, tasaIva) : 0;
        const total = sub + iva;
        const desc = c.aplica_iva ? `${c.descripcion} <span style='color:#999;font-size:11px'>(+IVA)</span>` : c.descripcion;
        return `<tr><td>${desc}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td><td class="right">${c.aplica_iva ? formatCurrency(iva, 'USD') : '—'}</td><td class="right">${formatCurrency(total, 'USD')}</td></tr>`;
      }
      return `<tr><td>${c.descripcion}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td></tr>`;
    }).join('');
    return `
      <h4>Conceptos en USD</h4>
      <table>
        <thead><tr>${headerCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const buildMxnTable = () => {
    if (conceptosMXN.length === 0) return '';
    const rows = conceptosMXN.map(c => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      const iva = calcularIVA(sub, tasaIva);
      return `<tr><td>${c.descripcion}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'MXN')}</td><td class="right">${formatCurrency(sub, 'MXN')}</td><td class="right">${formatCurrency(iva, 'MXN')}</td><td class="right">${formatCurrency(sub + iva, 'MXN')}</td></tr>`;
    }).join('');
    return `
      <h4>Conceptos en MXN + IVA</h4>
      <table>
        <thead><tr><th>Descripción</th><th class="right">Cantidad</th><th class="right">P. Unitario</th><th class="right">Subtotal</th><th class="right">IVA (${(tasaIva * 100).toFixed(0)}%)</th><th class="right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${proforma.numero} - Proforma</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f4c81; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #0f4c81; }
  .header .meta { text-align: right; font-size: 12px; color: #555; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #166534; }
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
  .resumen { margin-top: 20px; padding: 12px; border: 2px solid #0f4c81; border-radius: 8px; text-align: right; }
  .resumen p { font-size: 14px; font-weight: 700; color: #0f4c81; margin: 4px 0; }
  .resumen .nota { font-size: 11px; color: #777; font-weight: 400; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
  <div class="header">
    <div>
      <h1>PROFORMA ${proforma.numero}</h1>
      <p style="margin-top:4px">${proforma.cliente_nombre}</p>
    </div>
    <div class="meta">
      <span class="badge">Proforma</span>
      <p style="margin-top:6px">Fecha: ${formatDate(proforma.fecha_emision)}</p>
      <p>Expediente: ${proforma.expediente}</p>
    </div>
  </div>

  <section>
    <h3>Datos del Embarque</h3>
    <div class="grid">${gridCells(datosGenerales)}</div>
    ${embarque.descripcion_mercancia ? `<p style="margin-top:8px"><span class="label">Mercancía:</span> ${embarque.descripcion_mercancia}</p>` : ''}
  </section>

  <section>
    <h3>Conceptos</h3>
    ${buildUsdTable()}
    ${buildMxnTable()}
    <div class="resumen">
      ${conceptosUSD.length > 0 ? `
      <p>Subtotal USD: ${formatCurrency(Number(proforma.subtotal_usd), 'USD')}</p>
      ${Number(proforma.iva_usd) > 0 ? `<p>IVA USD: ${formatCurrency(Number(proforma.iva_usd), 'USD')}</p>` : ''}
      <p><strong>Total USD: ${formatCurrency(Number(proforma.total_usd), 'USD')}</strong></p>` : ''}
      ${conceptosMXN.length > 0 ? `
      <p style="margin-top:8px">Subtotal MXN: ${formatCurrency(Number(proforma.subtotal_mxn), 'MXN')}</p>
      <p>IVA (${(tasaIva * 100).toFixed(0)}%): ${formatCurrency(Number(proforma.iva_mxn), 'MXN')}</p>
      <p><strong>Total MXN: ${formatCurrency(Number(proforma.total_mxn), 'MXN')}</strong></p>` : ''}
    </div>
  </section>

  ${proforma.notas ? `<section><h3>Notas</h3><p>${proforma.notas}</p></section>` : ''}

  <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Libre Carga</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}
