/**
 * Bloque 3.4 — Estado de cuenta PDF por cliente.
 *
 * Lista facturas emitidas/vencidas con aging (0-30, 31-60, 61-90, +90 días)
 * y totales por moneda. Reusa el patrón print-to-PDF (`window.open` + `print`)
 * de cotizacionPdf.ts para no introducir dependencias nuevas.
 */
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { escapeHtml as esc } from "@/lib/utils";

interface FacturaCte {
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total: number;
  moneda: string;
  estado: string;
  expediente: string;
}

interface ClienteHeader {
  nombre: string;
  rfc: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  estado?: string | null;
}

interface Bucket {
  label: string;
  min: number;
  max: number;
}

const BUCKETS: Bucket[] = [
  { label: "Por vencer", min: -Infinity, max: 0 },
  { label: "1-30 días", min: 1, max: 30 },
  { label: "31-60 días", min: 31, max: 60 },
  { label: "61-90 días", min: 61, max: 90 },
  { label: "+90 días", min: 91, max: Infinity },
];

function bucketFor(diasVencido: number): string {
  return BUCKETS.find((b) => diasVencido >= b.min && diasVencido <= b.max)?.label ?? "";
}

export async function generarEstadoCuentaPdf(
  cliente: ClienteHeader & { id: string },
): Promise<void> {
  const { data, error } = await supabase
    .from("facturas")
    .select("numero, fecha_emision, fecha_vencimiento, total, moneda, estado, expediente")
    .eq("cliente_id", cliente.id)
    .in("estado", ["Emitida", "Vencida"])
    .order("fecha_emision", { ascending: true });
  if (error) throw error;

  const facturas: FacturaCte[] = (data ?? []) as FacturaCte[];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Agrupar por moneda para mostrar totales correctos.
  const monedas = Array.from(new Set(facturas.map((f) => f.moneda)));

  const rows = facturas
    .map((f) => {
      const venc = new Date(f.fecha_vencimiento);
      venc.setHours(0, 0, 0, 0);
      const dias = Math.floor((hoy.getTime() - venc.getTime()) / 86_400_000);
      return { ...f, diasVencido: dias, bucket: bucketFor(dias) };
    });

  const totalesPorMoneda = monedas.map((m) => {
    const fs = rows.filter((r) => r.moneda === m);
    const total = fs.reduce((s, r) => s + Number(r.total), 0);
    const buckets = BUCKETS.map((b) => ({
      label: b.label,
      total: fs
        .filter((r) => r.bucket === b.label)
        .reduce((s, r) => s + Number(r.total), 0),
    }));
    return { moneda: m, total, buckets };
  });

  const filasHtml = rows
    .map(
      (r) => `
        <tr>
          <td>${esc(r.numero)}</td>
          <td>${esc(r.expediente)}</td>
          <td>${formatDate(r.fecha_emision)}</td>
          <td>${formatDate(r.fecha_vencimiento)}</td>
          <td>${r.diasVencido > 0 ? `+${r.diasVencido}` : r.diasVencido}</td>
          <td>${esc(r.bucket)}</td>
          <td>${esc(r.estado)}</td>
          <td style="text-align:right">${formatCurrency(Number(r.total), r.moneda)}</td>
        </tr>`,
    )
    .join("");

  const agingHtml = totalesPorMoneda
    .map(
      (t) => `
        <table class="agg">
          <thead>
            <tr><th colspan="2">Antigüedad — ${esc(t.moneda)}</th></tr>
          </thead>
          <tbody>
            ${t.buckets
              .map(
                (b) => `<tr><td>${esc(b.label)}</td><td style="text-align:right">${formatCurrency(
                  b.total,
                  t.moneda,
                )}</td></tr>`,
              )
              .join("")}
            <tr class="tot"><td><strong>Total</strong></td><td style="text-align:right"><strong>${formatCurrency(
              t.total,
              t.moneda,
            )}</strong></td></tr>
          </tbody>
        </table>`,
    )
    .join("");

  const html = `<!doctype html><html lang="es-MX"><head>
    <meta charset="utf-8" />
    <title>Estado de cuenta — ${esc(cliente.nombre)}</title>
    <style>
      body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1B2B4B; padding: 24px; font-size: 12px; }
      h1 { margin: 0 0 4px; font-size: 18px; }
      .meta { color: #475569; font-size: 11px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
      th { background: #F8FAFC; font-weight: 600; }
      .aging { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px; }
      .agg { width: 280px; }
      .tot td { border-top: 2px solid #1B2B4B; }
      .footer { margin-top: 24px; font-size: 10px; color: #64748b; text-align: center; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>
    <h1>Estado de cuenta</h1>
    <div class="meta">
      <strong>${esc(cliente.nombre)}</strong>${cliente.rfc ? ` — RFC ${esc(cliente.rfc)}` : ""}<br/>
      ${esc(cliente.direccion ?? "")} ${esc(cliente.ciudad ?? "")} ${esc(cliente.estado ?? "")}<br/>
      Generado: ${formatDate(new Date().toISOString())}
    </div>

    ${
      rows.length === 0
        ? `<p>No hay facturas pendientes.</p>`
        : `<table>
            <thead><tr>
              <th>Factura</th><th>Expediente</th><th>Emisión</th><th>Vencimiento</th>
              <th>Días</th><th>Antigüedad</th><th>Estado</th><th style="text-align:right">Total</th>
            </tr></thead>
            <tbody>${filasHtml}</tbody>
          </table>
          <div class="aging">${agingHtml}</div>`
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
