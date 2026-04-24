import type { ProformaRow, ConceptoProforma } from '@/hooks/useProformas';
import { formatCurrency, formatDate } from '@/lib/formatters';

export function generarPdfProforma(proforma: ProformaRow) {
  const conceptos = (proforma.conceptos as unknown as ConceptoProforma[]) || [];

  const filas = conceptos.map(c => `
    <tr>
      <td>${c.descripcion}</td>
      <td class="right">${c.cantidad}</td>
      <td class="right">${formatCurrency(Number(c.precio_unitario), c.moneda)}</td>
      <td class="right">${formatCurrency(Number(c.total), c.moneda)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${proforma.numero} - Proforma</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI', Arial, sans-serif; color:#1a1a2e; padding:32px; font-size:13px; line-height:1.5; }
  .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:90px; color:rgba(220,38,38,0.08); font-weight:900; pointer-events:none; z-index:0; letter-spacing:8px; }
  .content { position:relative; z-index:1; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f4c81; padding-bottom:16px; margin-bottom:24px; }
  .header h1 { font-size:22px; color:#0f4c81; }
  .header .meta { text-align:right; font-size:12px; color:#555; }
  .badge-pro { display:inline-block; padding:4px 12px; border-radius:4px; font-size:12px; font-weight:700; background:#fef3c7; color:#92400e; border:2px solid #f59e0b; letter-spacing:1px; }
  .aviso { background:#fef2f2; border:2px solid #dc2626; color:#991b1b; padding:10px 14px; border-radius:6px; margin-bottom:18px; font-weight:700; text-align:center; font-size:13px; letter-spacing:0.5px; }
  section { margin-bottom:18px; }
  h3 { font-size:14px; color:#0f4c81; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:10px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px 16px; }
  .cell { display:flex; flex-direction:column; }
  .label { font-size:11px; color:#777; }
  .value { font-weight:600; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  th, td { border:1px solid #ddd; padding:6px 10px; text-align:left; font-size:12px; }
  th { background:#f0f4f8; font-weight:600; color:#333; }
  .right { text-align:right; }
  .resumen { margin-top:16px; padding:14px; border:2px solid #0f4c81; border-radius:8px; text-align:right; }
  .resumen p { font-size:14px; font-weight:700; color:#0f4c81; margin:4px 0; }
  .footer { margin-top:32px; border-top:1px solid #ddd; padding-top:10px; font-size:11px; color:#999; text-align:center; }
  @media print { body { padding:16px; } }
</style></head><body>
  <div class="watermark">PROFORMA</div>
  <div class="content">
    <div class="aviso">⚠ DOCUMENTO NO FISCAL — PROFORMA SOLO PARA REFERENCIA</div>

    <div class="header">
      <div>
        <h1>${proforma.numero}</h1>
        <p style="margin-top:4px">${proforma.cliente_nombre}</p>
        <p style="margin-top:2px;color:#666;font-size:12px">Expediente: ${proforma.expediente}</p>
      </div>
      <div class="meta">
        <span class="badge-pro">PROFORMA</span>
        <p style="margin-top:6px">Fecha: ${formatDate(proforma.created_at.substring(0,10))}</p>
        <p>Estado: ${proforma.estado}</p>
        ${proforma.factura_externa_folio ? `<p style="margin-top:4px;color:#059669;font-weight:600">Factura: ${proforma.factura_externa_folio}</p>` : ''}
      </div>
    </div>

    <section>
      <h3>Conceptos</h3>
      <table>
        <thead><tr><th>Descripción</th><th class="right">Cantidad</th><th class="right">P. Unitario</th><th class="right">Total</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="resumen">
        <p>Subtotal: ${formatCurrency(Number(proforma.subtotal), proforma.moneda)}</p>
        ${Number(proforma.iva) > 0 ? `<p>IVA: ${formatCurrency(Number(proforma.iva), proforma.moneda)}</p>` : ''}
        <p style="font-size:18px"><strong>Total: ${formatCurrency(Number(proforma.total), proforma.moneda)}</strong></p>
      </div>
    </section>

    ${proforma.notas ? `<section><h3>Notas</h3><p>${proforma.notas}</p></section>` : ''}

    <div class="footer">
      Documento generado el ${new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })} — Libre Carga<br>
      Esta proforma no constituye un comprobante fiscal. La factura fiscal se emitirá por separado.
    </div>
  </div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}
