/**
 * Estado de cuenta PDF por cliente (adaptador thin).
 *
 * Usa el mismo corte de la tabla/CSV (o carga facturas con saldo) + emisor,
 * calcula aging (Por vencer,
 * 1-30, 31-60, 61-90, +90 días) y totales por moneda, y delega el render a
 * `EstadoCuentaDocument` (@react-pdf/renderer) con descarga directa vía
 * `descargarPdf`. Reemplaza el flujo legacy `window.open + print`
 * (v13.823.248): el usuario recibe el archivo .pdf sin pasar por el diálogo
 * de impresión del navegador.
 */
import { fetchEstadoCuentaFacturas } from "@/features/facturacion/services";
import type { EstadoCuentaFactura } from "@/features/facturacion/services/exports";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { withOrgPrefix, slugifyOrg } from "@/lib/filenames";
import { diasVencidos } from "@/lib/date/dateOnly";
import { todayLocalISO } from "@/lib/date/today";
import { sumarMontos } from "@/lib/financial/financialUtils";
import type { EstadoCuentaAlcance } from "@/pdf/components/EstadoCuentaAlcance";
import type {
  EstadoCuentaBucketTotal,
  EstadoCuentaCliente,
  EstadoCuentaMonedaTotal,
  EstadoCuentaRow,
} from "@/pdf/documents/EstadoCuentaDocument";

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
  cliente: EstadoCuentaCliente & { id: string },
  snapshot?: readonly EstadoCuentaFactura[],
  alcance?: EstadoCuentaAlcance,
): Promise<void> {
  const [facturas, emisor, { EstadoCuentaDocument }] = await Promise.all([
    snapshot ?? fetchEstadoCuentaFacturas(cliente.id),
    cargarEmisorEmpresa(),
    // P12: el Document se carga dinámicamente para no arrastrar @react-pdf al bundle inicial.
    import("@/pdf/documents/EstadoCuentaDocument"),
  ]);
  const hoy = todayLocalISO();

  const rows: EstadoCuentaRow[] = facturas.map((f) => {
    const dias = diasVencidos(f.fecha_vencimiento, hoy);
    return { ...f, diasVencido: dias, bucket: bucketFor(dias) };
  });

  const monedas = Array.from(new Set(rows.map((r) => r.moneda)));
  const totalesPorMoneda: EstadoCuentaMonedaTotal[] = monedas.map((m) => {
    const fs = rows.filter((r) => r.moneda === m);
    const buckets: EstadoCuentaBucketTotal[] = BUCKETS.map((b) => ({
      label: b.label,
      total: sumarMontos(fs.filter((r) => r.bucket === b.label).map((r) => r.saldo)),
    }));
    return { moneda: m, total: sumarMontos(fs.map((r) => r.saldo)), buckets };
  });

  const nombre = await withOrgPrefix(`estado-de-cuenta-${slugifyOrg(cliente.nombre)}`);
  await descargarPdf(
    <EstadoCuentaDocument
      cliente={cliente}
      rows={rows}
      totalesPorMoneda={totalesPorMoneda}
      emisor={emisor}
      alcance={alcance ?? { parcial: snapshot !== undefined, filtros: [snapshot !== undefined ? "Selección de facturas" : "Sólo facturas con saldo"] }}
    />,
    nombre,
  );
}
