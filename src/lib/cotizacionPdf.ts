import type { CotizacionRow, DimensionLCL, DimensionAerea } from '@/hooks/useCotizaciones';

const formatCurrencyPdf = (amount: number, currency: string = 'MXN'): string => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};

const formatDatePdf = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function generarPdfCotizacion(cotizacion: CotizacionRow) {
  const nombreDestinatario = cotizacion.es_prospecto
    ? `${cotizacion.prospecto_empresa} (Prospecto)`
    : cotizacion.cliente_nombre;

  const esMaritimo = cotizacion.modo === 'Marítimo';
  const esAereo = cotizacion.modo === 'Aéreo';
  const dimensiones: DimensionLCL[] = Array.isArray(cotizacion.dimensiones_lcl) ? cotizacion.dimensiones_lcl : [];
  const dimensionesAereas: DimensionAerea[] = Array.isArray(cotizacion.dimensiones_aereas) ? cotizacion.dimensiones_aereas : [];

  // Build general data rows
  const datosGenerales: [string, string][] = [
    ['Modo', cotizacion.modo],
    ['Tipo', cotizacion.tipo],
    ['Incoterm', cotizacion.incoterm],
    ['Moneda', cotizacion.moneda],
    ['Origen', cotizacion.origen || '-'],
    ['Destino', cotizacion.destino || '-'],
    ['Vigencia', `${cotizacion.vigencia_dias} días${cotizacion.fecha_vigencia ? ` (${formatDatePdf(cotizacion.fecha_vigencia)})` : ''}`],
    ['Operador', cotizacion.operador || '-'],
  ];

  if (cotizacion.tiempo_transito_dias != null) {
    datosGenerales.push(['Tiempo de tránsito', `${cotizacion.tiempo_transito_dias} días`]);
  }
  if (esMaritimo && cotizacion.tipo_embarque === 'FCL' && cotizacion.dias_libres_destino > 0) {
    datosGenerales.push(['Días libres en destino', `${cotizacion.dias_libres_destino} días`]);
  }
  if (esMaritimo && cotizacion.tipo_embarque === 'FCL') {
    datosGenerales.push(['Carta garantía', cotizacion.carta_garantia ? 'Sí' : 'No']);
  }
  if (esMaritimo && cotizacion.tipo_embarque === 'LCL' && cotizacion.dias_almacenaje > 0) {
    datosGenerales.push(['Días libres de almacenaje', `${cotizacion.dias_almacenaje} días`]);
  }
  if (cotizacion.frecuencia) {
    datosGenerales.push(['Frecuencia', cotizacion.frecuencia]);
  }
  if (cotizacion.ruta_texto) {
    datosGenerales.push(['Ruta', cotizacion.ruta_texto]);
  }
  if (cotizacion.tipo_movimiento) {
    datosGenerales.push(['Tipo de movimiento', cotizacion.tipo_movimiento]);
  }
  datosGenerales.push(['Seguro', cotizacion.seguro ? `Sí — $${Number(cotizacion.valor_seguro_usd || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USD` : 'No']);

  // Build mercancia rows
  const mercancia: [string, string][] = [];
  if (esMaritimo) {
    mercancia.push(['Tipo de Embarque', cotizacion.tipo_embarque]);
  }
  if (esMaritimo && cotizacion.tipo_embarque === 'FCL') {
    mercancia.push(['Tipo de Contenedor', cotizacion.tipo_contenedor || '-']);
    mercancia.push(['Peso', cotizacion.tipo_peso]);
  }
  mercancia.push(['Tipo de Carga', cotizacion.tipo_carga || 'Carga General']);
  mercancia.push(['Sector Económico', cotizacion.sector_economico || cotizacion.descripcion_mercancia || '-']);
  if (!esMaritimo && !esAereo) {
    mercancia.push(['Peso', `${cotizacion.peso_kg} kg`]);
    mercancia.push(['Volumen', `${cotizacion.volumen_m3} m³`]);
    mercancia.push(['Piezas', `${cotizacion.piezas}`]);
  }

  const gridCells = (items: [string, string][]) => items.map(
    ([label, value]) => `<div class="cell"><span class="label">${label}</span><span class="value">${value}</span></div>`
  ).join('');

  // Dimensions table
  let dimensionesHtml = '';
  if (esMaritimo && cotizacion.tipo_embarque === 'LCL' && dimensiones.length > 0) {
    dimensionesHtml = `
      <h4>Dimensiones</h4>
      <table><thead><tr><th>Piezas</th><th>Alto (cm)</th><th>Largo (cm)</th><th>Ancho (cm)</th><th>Volumen m³</th></tr></thead>
      <tbody>${dimensiones.map(d => `<tr><td>${d.piezas}</td><td>${d.alto_cm}</td><td>${d.largo_cm}</td><td>${d.ancho_cm}</td><td>${d.volumen_m3.toFixed(4)}</td></tr>`).join('')}</tbody></table>
      <p class="totals">Total piezas: ${cotizacion.piezas} &nbsp;|&nbsp; Volumen total: ${cotizacion.volumen_m3} m³</p>`;
  }
  if (esAereo && dimensionesAereas.length > 0) {
    dimensionesHtml = `
      <h4>Dimensiones</h4>
      <table><thead><tr><th>Piezas</th><th>Alto (cm)</th><th>Largo (cm)</th><th>Ancho (cm)</th><th>Peso vol. (kg)</th></tr></thead>
      <tbody>${dimensionesAereas.map(d => `<tr><td>${d.piezas}</td><td>${d.alto_cm}</td><td>${d.largo_cm}</td><td>${d.ancho_cm}</td><td>${d.peso_volumetrico_kg.toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <p class="totals">Total piezas: ${cotizacion.piezas} &nbsp;|&nbsp; Peso volumétrico total: ${cotizacion.peso_kg} kg</p>`;
  }

  // Conceptos de venta
  const conceptosRows = cotizacion.conceptos_venta.map(c =>
    `<tr><td>${c.descripcion}</td><td class="right">${c.cantidad}</td><td class="right">${formatCurrencyPdf(c.precio_unitario, c.moneda)}</td><td class="right">${formatCurrencyPdf(c.total, c.moneda)}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${cotizacion.folio} - Cotización</title>
<style>
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
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
  <div class="header">
    <div>
      <h1>${cotizacion.folio}</h1>
      <p style="margin-top:4px">${nombreDestinatario}</p>
    </div>
    <div class="meta">
      <span class="badge">${cotizacion.estado}</span>
      <p style="margin-top:6px">Fecha: ${formatDatePdf(cotizacion.created_at.substring(0, 10))}</p>
    </div>
  </div>

  ${cotizacion.es_prospecto ? `<section>
    <h3>Datos del Prospecto</h3>
    <div class="grid">
      <div class="cell"><span class="label">Empresa</span><span class="value">${cotizacion.prospecto_empresa}</span></div>
      <div class="cell"><span class="label">Contacto</span><span class="value">${cotizacion.prospecto_contacto}</span></div>
      <div class="cell"><span class="label">Email</span><span class="value">${cotizacion.prospecto_email || '-'}</span></div>
      <div class="cell"><span class="label">Teléfono</span><span class="value">${cotizacion.prospecto_telefono || '-'}</span></div>
    </div>
  </section>` : ''}

  <section>
    <h3>Datos Generales</h3>
    <div class="grid">${gridCells(datosGenerales)}</div>
  </section>

  <section>
    <h3>Mercancía</h3>
    <div class="grid">${gridCells(mercancia)}</div>
    ${cotizacion.descripcion_adicional ? `<p style="margin-top:8px"><span class="label">Descripción Adicional:</span> ${cotizacion.descripcion_adicional}</p>` : ''}
    ${dimensionesHtml}
  </section>

  <section>
    <h3>Conceptos de Venta</h3>
    <table>
      <thead><tr><th>Descripción</th><th class="right">Cantidad</th><th class="right">Precio Unitario</th><th class="right">Total</th></tr></thead>
      <tbody>${conceptosRows}</tbody>
    </table>
    <p class="subtotal">Subtotal: ${formatCurrencyPdf(cotizacion.subtotal, cotizacion.moneda)}</p>
  </section>

  ${cotizacion.notas ? `<section><h3>Notas</h3><p>${cotizacion.notas}</p></section>` : ''}

  <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} — eLogistix</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}
