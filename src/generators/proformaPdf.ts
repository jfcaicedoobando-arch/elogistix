import { calcularIVA, TASA_IVA } from '@/lib/financialUtils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type ProformaRow = Tables<'proformas'>;
type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;
type ClienteRow = Tables<'clientes'>;

interface GenerarPdfProformaParams {
  proforma: ProformaRow;
  embarque: Pick<EmbarqueRow, 'expediente' | 'bl_master' | 'modo' | 'tipo' | 'incoterm' | 'puerto_origen' | 'puerto_destino' | 'aeropuerto_origen' | 'aeropuerto_destino' | 'ciudad_origen' | 'ciudad_destino' | 'naviera' | 'aerolinea' | 'descripcion_mercancia'>;
  conceptos: ConceptoVenta[];
  cliente?: Pick<ClienteRow, 'nombre' | 'rfc' | 'direccion' | 'ciudad' | 'estado' | 'cp'> | null;
  tasaIva?: number;
}

function formatearDescripcionConcepto(descripcion: string): string {
  if (descripcion.toLowerCase() === 'flete terrestre') {
    return 'Servicios de Logística (Flete Terrestre)';
  }
  return descripcion;
}

export function generarPdfProforma({ proforma, embarque, conceptos, cliente, tasaIva = TASA_IVA }: GenerarPdfProformaParams) {
  const conceptosUSD = conceptos.filter(c => c.moneda === 'USD');
  const conceptosMXN = conceptos.filter(c => c.moneda === 'MXN');

  const origen = embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || '-';
  const destino = embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || '-';

  // Dirección compuesta del cliente
  const direccionCompleta = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).join(', ')
    : '';

  const buildUsdTable = () => {
    if (conceptosUSD.length === 0) return '';
    const hayIva = conceptosUSD.some(c => c.aplica_iva);
    const headerCols = hayIva
      ? `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th><th class="right">IVA</th>`
      : `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th>`;
      const rows = conceptosUSD.map(c => {
        const sub = Number(c.cantidad) * Number(c.precio_unitario);
        if (hayIva) {
          const iva = c.aplica_iva ? calcularIVA(sub, tasaIva) : 0;
          return `<tr><td>${formatearDescripcionConcepto(c.descripcion)}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td><td class="right">${c.aplica_iva ? formatCurrency(iva, 'USD') : '—'}</td></tr>`;
        }
        return `<tr><td>${formatearDescripcionConcepto(c.descripcion)}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'USD')}</td><td class="right">${formatCurrency(sub, 'USD')}</td></tr>`;
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
  };

  const buildMxnTable = () => {
    if (conceptosMXN.length === 0) return '';
    const rows = conceptosMXN.map(c => {
      const sub = Number(c.cantidad) * Number(c.precio_unitario);
      return `<tr><td>${formatearDescripcionConcepto(c.descripcion)}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrency(Number(c.precio_unitario), 'MXN')}</td><td class="right">${formatCurrency(sub, 'MXN')}</td></tr>`;
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
  };

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${proforma.numero} - Proforma</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f4c81; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 32px; color: #0f4c81; letter-spacing: 2px; font-weight: 800; }
  .header .numero { font-size: 16px; color: #333; margin-top: 4px; font-weight: 600; }
  .header .meta { text-align: right; font-size: 12px; color: #555; }
  .header .meta .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #92400e; letter-spacing: 0.5px; }
  section { margin-bottom: 18px; }
  h3 { font-size: 14px; color: #0f4c81; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  h4 { font-size: 13px; color: #333; margin: 14px 0 6px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; }
  .cell { display: flex; flex-direction: column; }
  .label { font-size: 11px; color: #777; }
  .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
  th { background: #f0f4f8; font-weight: 600; color: #333; }
  .right { text-align: right; }
  .subtotal-block { margin-top: 8px; text-align: right; font-size: 13px; }
  .subtotal-block p { margin: 2px 0; }
  .subtotal-block .total-line { font-size: 15px; color: #0f4c81; border-top: 2px solid #0f4c81; padding-top: 4px; margin-top: 6px; display: inline-block; padding-left: 20px; }
  .footer-aviso { margin-top: 32px; padding: 12px; border: 2px dashed #d97706; background: #fef3c7; border-radius: 6px; text-align: center; font-size: 12px; color: #92400e; font-weight: 600; }
  .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
  <div class="header">
    <div>
      <h1>PROFORMA</h1>
      <p class="numero">${proforma.numero}</p>
    </div>
    <div class="meta">
      <span class="badge">SIN VALIDEZ FISCAL</span>
      <p style="margin-top:6px"><strong>Fecha de emisión:</strong> ${formatDate(proforma.fecha_emision)}</p>
      <p><strong>Expediente:</strong> ${proforma.expediente}</p>
      ${proforma.bl_master ? `<p><strong>BL/MAWB:</strong> ${proforma.bl_master}</p>` : ''}
    </div>
  </div>

  <section>
    <h3>Datos del Cliente</h3>
    <div class="grid">
      <div class="cell"><span class="label">Razón Social</span><span class="value">${cliente?.nombre || proforma.cliente_nombre}</span></div>
      <div class="cell"><span class="label">RFC</span><span class="value">${cliente?.rfc || '-'}</span></div>
      <div class="cell" style="grid-column: 1 / -1"><span class="label">Dirección</span><span class="value">${direccionCompleta || '-'}</span></div>
    </div>
  </section>

  <section>
    <h3>Datos del Embarque</h3>
    <div class="grid-3">
      <div class="cell"><span class="label">Modo</span><span class="value">${embarque.modo}</span></div>
      <div class="cell"><span class="label">Tipo</span><span class="value">${embarque.tipo}</span></div>
      <div class="cell"><span class="label">Incoterm</span><span class="value">${embarque.incoterm}</span></div>
      <div class="cell"><span class="label">Origen</span><span class="value">${origen}</span></div>
      <div class="cell"><span class="label">Destino</span><span class="value">${destino}</span></div>
      <div class="cell"><span class="label">Ruta</span><span class="value">${origen} → ${destino}</span></div>
    </div>
    ${embarque.descripcion_mercancia ? `<p style="margin-top:8px"><span class="label">Descripción de la mercancía:</span> <strong>${embarque.descripcion_mercancia}</strong></p>` : ''}
  </section>

  <section>
    <h3>Condiciones Comerciales</h3>
    <div class="grid">
      <div class="cell"><span class="label">Ejecutivo de Operaciones</span><span class="value">${proforma.operador || '—'}</span></div>
      <div class="cell"><span class="label">Días de crédito</span><span class="value">${proforma.dias_credito == null ? '—' : (Number(proforma.dias_credito) === 0 ? 'Contado' : `${proforma.dias_credito} días`)}</span></div>
    </div>
  </section>

  <section>
    <h3>Conceptos</h3>
    ${buildUsdTable()}
    ${buildMxnTable()}
  </section>

  ${proforma.notas ? `<section><h3>Notas</h3><p>${proforma.notas}</p></section>` : ''}

  <div class="footer-aviso">
    ⚠ Este documento es una proforma y no tiene validez fiscal
  </div>

  <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — Libre Carga</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}
