/**
 * Adaptador thin para el PDF de rentabilidad por cliente.
 * Carga los datos del emisor desde `configuracion.empresa`.
 */
import {
  RentabilidadDocument,
  type RentabilidadClienteRow,
  type RentabilidadKpis,
} from "@/pdf/documents/RentabilidadDocument";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { slugifyOrg } from "@/lib/filenames";

export type { RentabilidadClienteRow, RentabilidadKpis };

export interface RentabilidadPdfInput {
  fechaDesde: string;
  fechaHasta: string;
  modo?: string;
  kpis: RentabilidadKpis;
  clientes: RentabilidadClienteRow[];
}

export async function generarRentabilidadPdf(input: RentabilidadPdfInput): Promise<void> {
  const emisor = await cargarEmisorEmpresa();
  await descargarPdf(
    <RentabilidadDocument {...input} emisor={emisor} />,
    `${slugifyOrg(emisor.razonSocial)}_rentabilidad-${input.fechaDesde}_${input.fechaHasta}`,
  );
}
