import { CUBETA_LABELS_LARGAS, type CubetaAging } from "@/lib/aging/buckets";
import { formatDate } from "@/lib/formatters";
import type { EstadoCuentaAlcance } from "@/pdf/components/EstadoCuentaAlcance";

export interface EstadoCuentaFiltrosExportacion {
  desde?: string | null;
  hasta?: string | null;
  moneda?: string;
  soloConSaldo?: boolean;
  busqueda?: string;
  bucket?: CubetaAging | null;
}

/** Describe el mismo corte que alimenta el PDF, sin recalcular sus importes. */
export function crearEstadoCuentaAlcance(f: EstadoCuentaFiltrosExportacion): EstadoCuentaAlcance {
  const filtros: string[] = [];
  if (f.desde || f.hasta) {
    filtros.push(`Emisión: ${f.desde ? formatDate(f.desde) : "sin fecha inicial"} a ${f.hasta ? formatDate(f.hasta) : "sin fecha final"}`);
  }
  if (f.moneda && f.moneda !== "todas") filtros.push(`Moneda: ${f.moneda}`);
  if (f.soloConSaldo) filtros.push("Sólo con saldo");
  if (f.bucket) filtros.push(`Antigüedad: ${CUBETA_LABELS_LARGAS[f.bucket]}`);
  if (f.busqueda?.trim()) filtros.push(`Folio o expediente: ${f.busqueda.trim()}`);
  return { parcial: filtros.length > 0, filtros };
}
