/**
 * Bloque 3.4 — PDF de rentabilidad por cliente (rango configurable).
 *
 * Toma la misma data del listado de Reportes (`useRentabilidadClientes`) y
 * genera un PDF imprimible con KPIs y tabla. No introduce dependencias.
 */
import { formatCurrency } from "@/lib/formatters";
import { escapeHtml as esc } from "@/lib/utils/htmlEscape";

export interface RentabilidadClienteRow {
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
}

export interface RentabilidadKpis {
  total_venta_usd: number;
  total_costo_usd: number;
  total_profit_usd: number;
  margen_promedio: number;
}

export interface RentabilidadPdfInput {
  fechaDesde: string;
  fechaHasta: string;
  modo?: string;
  kpis: RentabilidadKpis;
  clientes: RentabilidadClienteRow[];
}

export function generarRentabilidadPdf({
  fechaDesde,
  fechaHasta,
  modo,
  kpis,
  clientes,
}: RentabilidadPdfInput): void {
  const rows = [...clientes].sort((a, b) => b.profit_usd - a.profit_usd);

  const filas = rows
    .map(
      (c) => `
      <tr>
        <td>${esc(c.cliente_nombre)}</td>
        <td style="text-align:right">${c.total_embarques}</td>
        <td style="text-align:right">${formatCurrency(c.venta_usd, "USD")}</td>
        <td style="text-align:right">${formatCurrency(c.costo_usd, "USD")}</td>
        <td style="text-align:right">${formatCurrency(c.profit_usd, "USD")}</td>
        <td style="text-align:right">${c.margen.toFixed(1)}%</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="es-MX"><head>
    <meta charset="utf-8" />
    <title>Rentabilidad por cliente</title>
    <style>
      body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1B2B4B; padding: 24px; font-size: 12px; }
      h1 { margin: 0 0 4px; font-size: 18px; }
      .meta { color: #475569; font-size: 11px; margin-bottom: 16px; }
      .kpis { display: flex; gap: 12px; margin: 12px 0 16px; flex-wrap: wrap; }
      .kpi { background: #F8FAFC; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; min-width: 140px; }
      .kpi .l { font-size: 10px; color: #64748b; text-transform: uppercase; }
      .kpi .v { font-size: 16px; font-weight: 600; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
      th { background: #F8FAFC; font-weight: 600; }
      .footer { margin-top: 24px; font-size: 10px; color: #64748b; text-align: center; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>
    <h1>Rentabilidad por cliente</h1>
    <div class="meta">Período: ${esc(fechaDesde)} → ${esc(fechaHasta)}${modo && modo !== "all" ? ` · Modo: ${esc(modo)}` : ""}</div>

    <div class="kpis">
      <div class="kpi"><div class="l">Venta total</div><div class="v">${formatCurrency(kpis.total_venta_usd, "USD")}</div></div>
      <div class="kpi"><div class="l">Costo total</div><div class="v">${formatCurrency(kpis.total_costo_usd, "USD")}</div></div>
      <div class="kpi"><div class="l">Profit total</div><div class="v">${formatCurrency(kpis.total_profit_usd, "USD")}</div></div>
      <div class="kpi"><div class="l">Margen promedio</div><div class="v">${kpis.margen_promedio.toFixed(1)}%</div></div>
    </div>

    ${
      rows.length === 0
        ? `<p>No hay datos en el período seleccionado.</p>`
        : `<table>
            <thead><tr>
              <th>Cliente</th>
              <th style="text-align:right">Embarques</th>
              <th style="text-align:right">Venta</th>
              <th style="text-align:right">Costo</th>
              <th style="text-align:right">Profit</th>
              <th style="text-align:right">Margen</th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>`
    }

    <div class="footer">Libre Carga — documento generado ${new Date().toLocaleString("es-MX")}</div>
  </body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }
}
