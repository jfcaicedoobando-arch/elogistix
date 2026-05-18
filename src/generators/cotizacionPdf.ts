import type { CotizacionRow } from '@/types/cotizacion';
import { TASA_IVA } from '@/lib/financial/financialUtils';
import { escapeHtml as esc } from '@/lib/utils';
import { buildDatosGenerales, buildMercancia, gridCellsHtml } from './cotizacion/datosGenerales';
import { buildDimensionesHtml } from './cotizacion/dimensiones';
import { calcularTotales, splitConceptos, buildUsdTable, buildMxnTable } from './cotizacion/conceptosTables';
import {
  pdfStyles,
  buildHeaderHtml,
  buildProspectoHtml,
  buildResumenHtml,
  buildFooterHtml,
} from './cotizacion/pdfShell';

export function generarPdfCotizacion(cotizacion: CotizacionRow, tasaIva: number = TASA_IVA) {
  const totales = calcularTotales(cotizacion.conceptos_venta);
  const { usd, mxn } = splitConceptos(cotizacion.conceptos_venta);

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(cotizacion.folio)} - Cotización</title>
<style>${pdfStyles}</style></head><body>
  ${buildHeaderHtml(cotizacion)}
  ${buildProspectoHtml(cotizacion)}

  <section>
    <h3>Datos Generales</h3>
    <div class="grid">${gridCellsHtml(buildDatosGenerales(cotizacion))}</div>
  </section>

  <section>
    <h3>Mercancía</h3>
    <div class="grid">${gridCellsHtml(buildMercancia(cotizacion))}</div>
    ${cotizacion.descripcion_adicional ? `<p style="margin-top:8px"><span class="label">Descripción Adicional:</span> ${esc(cotizacion.descripcion_adicional)}</p>` : ''}
    ${buildDimensionesHtml(cotizacion)}
  </section>

  <div class="page-break"></div>

  <section>
    <h3>Conceptos de Venta</h3>
    ${buildUsdTable(usd, totales.totalUSD, tasaIva)}
    ${buildMxnTable(mxn, totales, tasaIva)}
    ${buildResumenHtml(totales, mxn.length > 0)}
  </section>

  ${cotizacion.notas ? `<section><h3>Notas</h3><p>${esc(cotizacion.notas)}</p></section>` : ''}

  ${buildFooterHtml()}
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}
