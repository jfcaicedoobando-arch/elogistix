import { calcularIVA, TASA_IVA } from '@/lib/financialUtils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type ProformaRow = Tables<'proformas'>;
type ConceptoVenta = Tables<'conceptos_venta'>;
type EmbarqueRow = Tables<'embarques'>;
type ClienteRow = Tables<'clientes'>;

export interface ContenedorConConceptos {
  embarque: Pick<EmbarqueRow, 'id' | 'expediente' | 'contenedor' | 'tipo_contenedor'>;
  conceptos: ConceptoVenta[];
}

interface GenerarPdfParams {
  proforma: ProformaRow;
  blMaster: string | null;
  contenedores: ContenedorConConceptos[];
  cliente?: Pick<ClienteRow, 'nombre' | 'rfc' | 'direccion' | 'ciudad' | 'estado' | 'cp'> | null;
  tasaIva?: number;
}

function formatearDescripcion(descripcion: string): string {
  if (descripcion.toLowerCase() === 'flete terrestre') {
    return 'Servicios de Logística (Flete Terrestre)';
  }
  return descripcion;
}

export function generarPdfProformaConsolidada({
  proforma, blMaster, contenedores, cliente, tasaIva = TASA_IVA,
}: GenerarPdfParams) {
  const direccionCompleta = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).join(', ')
    : '';

  const buildContenedorBloque = (c: ContenedorConConceptos) => {
    const usd = c.conceptos.filter(x => x.moneda === 'USD');
    const mxn = c.conceptos.filter(x => x.moneda === 'MXN');
    const titulo = c.embarque.contenedor
      ? `Contenedor ${c.embarque.contenedor}${c.embarque.tipo_contenedor ? ` (${c.embarque.tipo_contenedor})` : ''}`
      : `Embarque ${c.embarque.expediente}`;

    const renderTabla = (lista: ConceptoVenta[], moneda: 'USD' | 'MXN') => {
      if (lista.length === 0) return '';
      const hayIva = lista.some(x => x.aplica_iva);
      const headerCols = hayIva
        ? `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th><th class="right">IVA</th>`
        : `<th>Descripción</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">Total</th>`;
      const rows = lista.map(x => {
        const sub = Number(x.cantidad) * Number(x.precio_unitario);
        const cells = `<td>${formatearDescripcion(x.descripcion)}</td><td class="right">${x.cantidad}</td><td class="right">${formatCurrency(Number(x.precio_unitario), moneda)}</td><td class="right">${formatCurrency(sub, moneda)}</td>`;
        if (hayIva) {
          const iva = x.aplica_iva ? calcularIVA(sub, tasaIva) : 0;
          return `<tr>${cells}<td class="right">${x.aplica_iva ? formatCurrency(iva, moneda) : '—'}</td></tr>`;
        }
        return `<tr>${cells}</tr>`;
      }).join('');
      return `
        <p class="moneda-label">Conceptos en ${moneda}</p>
        <table>
          <thead><tr>${headerCols}</tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    return `
      <div class="contenedor-bloque">
        <h4 class="contenedor-titulo">📦 ${titulo}</h4>
        ${renderTabla(usd, 'USD')}
        ${renderTabla(mxn, 'MXN')}
      </div>`;
  };

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${proforma.numero} - Proforma Consolidada</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f4c81; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 32px; color: #0f4c81; letter-spacing: 2px; font-weight: 800; }
  .header .numero { font-size: 16px; color: #333; margin-top: 4px; font-weight: 600; }
  .header .meta { text-align: right; font-size: 12px; color: #555; }
  .header .meta .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #92400e; letter-spacing: 0.5px; }
  .header .meta .badge-consolidada { background: #dbeafe; color: #1e3a8a; margin-left: 6px; }
  section { margin-bottom: 18px; }
  h3 { font-size: 14px; color: #0f4c81; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; }
  .cell { display: flex; flex-direction: column; }
  .label { font-size: 11px; color: #777; }
  .value { font-weight: 600; }
  .contenedor-bloque { margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; background: #fafbfc; }
  .contenedor-titulo { font-size: 13px; color: #0f4c81; font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px dashed #cbd5e1; }
  .moneda-label { font-size: 11px; color: #555; font-weight: 600; margin: 8px 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; font-size: 11.5px; }
  th { background: #f0f4f8; font-weight: 600; color: #333; }
  .right { text-align: right; }
  .totales-globales { margin-top: 16px; padding: 12px 16px; background: #f0f4f8; border-radius: 6px; border: 2px solid #0f4c81; }
  .totales-globales h3 { color: #0f4c81; border: none; padding: 0; margin-bottom: 8px; }
  .totales-globales .linea { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
  .totales-globales .total-line { font-size: 15px; color: #0f4c81; font-weight: 700; border-top: 2px solid #0f4c81; padding-top: 4px; margin-top: 4px; }
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
      <span class="badge badge-consolidada">CONSOLIDADA (${contenedores.length})</span>
      <p style="margin-top:6px"><strong>Fecha de emisión:</strong> ${formatDate(proforma.fecha_emision)}</p>
      <p><strong>Expediente:</strong> ${proforma.expediente}</p>
      ${blMaster ? `<p><strong>BL Master:</strong> ${blMaster}</p>` : ''}
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
    <h3>Condiciones Comerciales</h3>
    <div class="grid">
      <div class="cell"><span class="label">Ejecutivo de Operaciones</span><span class="value">${proforma.operador || '—'}</span></div>
      <div class="cell"><span class="label">Días de crédito</span><span class="value">${proforma.dias_credito == null ? '—' : (Number(proforma.dias_credito) === 0 ? 'Contado' : `${proforma.dias_credito} días`)}</span></div>
    </div>
  </section>

  <section>
    <h3>Conceptos por Contenedor</h3>
    ${contenedores.map(buildContenedorBloque).join('')}
  </section>

  <div class="totales-globales">
    <h3>Totales Consolidados</h3>
    ${Number(proforma.total_usd) > 0 ? `
      <div class="linea"><span>Subtotal USD:</span><span>${formatCurrency(Number(proforma.subtotal_usd), 'USD')}</span></div>
      ${Number(proforma.iva_usd) > 0 ? `<div class="linea"><span>IVA USD:</span><span>${formatCurrency(Number(proforma.iva_usd), 'USD')}</span></div>` : ''}
      <div class="linea total-line"><span>TOTAL USD:</span><span>${formatCurrency(Number(proforma.total_usd), 'USD')}</span></div>
    ` : ''}
    ${Number(proforma.total_mxn) > 0 ? `
      <div class="linea" style="margin-top:8px"><span>Subtotal MXN:</span><span>${formatCurrency(Number(proforma.subtotal_mxn), 'MXN')}</span></div>
      <div class="linea"><span>IVA MXN:</span><span>${formatCurrency(Number(proforma.iva_mxn), 'MXN')}</span></div>
      <div class="linea total-line"><span>TOTAL MXN:</span><span>${formatCurrency(Number(proforma.total_mxn), 'MXN')}</span></div>
    ` : ''}
  </div>

  ${proforma.notas ? `<section style="margin-top:20px"><h3>Notas</h3><p>${proforma.notas}</p></section>` : ''}

  <div class="footer-aviso">
    ⚠ Este documento es una proforma consolidada y no tiene validez fiscal
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
