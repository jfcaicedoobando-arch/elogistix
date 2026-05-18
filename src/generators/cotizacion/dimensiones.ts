import type { CotizacionRow, DimensionLCL, DimensionAerea } from '@/types/cotizacion';

export function buildDimensionesHtml(c: CotizacionRow): string {
  const esMaritimoLcl = c.modo === 'Marítimo' && c.tipo_embarque === 'LCL';
  const esAereo = c.modo === 'Aéreo';
  const lcl: DimensionLCL[] = Array.isArray(c.dimensiones_lcl) ? c.dimensiones_lcl : [];
  const aereas: DimensionAerea[] = Array.isArray(c.dimensiones_aereas) ? c.dimensiones_aereas : [];

  if (esMaritimoLcl && lcl.length > 0) {
    return `
      <h4>Dimensiones</h4>
      <table><thead><tr><th>Piezas</th><th>Alto (cm)</th><th>Largo (cm)</th><th>Ancho (cm)</th><th>Volumen m³</th></tr></thead>
      <tbody>${lcl
        .map(
          (d) =>
            `<tr><td>${d.piezas}</td><td>${d.alto_cm}</td><td>${d.largo_cm}</td><td>${d.ancho_cm}</td><td>${d.volumen_m3.toFixed(4)}</td></tr>`,
        )
        .join('')}</tbody></table>
      <p class="totals">Total piezas: ${c.piezas} &nbsp;|&nbsp; Volumen total: ${c.volumen_m3} m³</p>`;
  }
  if (esAereo && aereas.length > 0) {
    return `
      <h4>Dimensiones</h4>
      <table><thead><tr><th>Piezas</th><th>Alto (cm)</th><th>Largo (cm)</th><th>Ancho (cm)</th><th>Peso vol. (kg)</th></tr></thead>
      <tbody>${aereas
        .map(
          (d) =>
            `<tr><td>${d.piezas}</td><td>${d.alto_cm}</td><td>${d.largo_cm}</td><td>${d.ancho_cm}</td><td>${d.peso_volumetrico_kg.toFixed(2)}</td></tr>`,
        )
        .join('')}</tbody></table>
      <p class="totals">Total piezas: ${c.piezas} &nbsp;|&nbsp; Peso volumétrico total: ${c.peso_kg} kg</p>`;
  }
  return '';
}
