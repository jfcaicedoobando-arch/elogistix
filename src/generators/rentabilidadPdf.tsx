/**
 * Adaptador thin para el PDF de rentabilidad por cliente.
 * Mantiene la firma usada por useReportesPageController.
 */
import {
  RentabilidadDocument,
  type RentabilidadClienteRow,
  type RentabilidadKpis,
} from "@/pdf/documents/RentabilidadDocument";
import { descargarPdf } from "@/pdf/render/descargarPdf";

export type { RentabilidadClienteRow, RentabilidadKpis };

export interface RentabilidadPdfInput {
  fechaDesde: string;
  fechaHasta: string;
  modo?: string;
  kpis: RentabilidadKpis;
  clientes: RentabilidadClienteRow[];
}

export function generarRentabilidadPdf(input: RentabilidadPdfInput): void {
  void descargarPdf(
    <RentabilidadDocument {...input} />,
    `rentabilidad-${input.fechaDesde}_${input.fechaHasta}`,
  );
}
