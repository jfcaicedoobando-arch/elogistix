/**
 * Adaptador thin para el PDF de rentabilidad por cliente.
 * Identifica la organización comercial del reporte, sin sustituir datos fiscales.
 */
import type {
  RentabilidadClienteRow,
  RentabilidadKpis,
} from "@/pdf/documents/RentabilidadDocument";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { slugifyOrg } from "@/lib/filenames";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export type { RentabilidadClienteRow, RentabilidadKpis };

export interface RentabilidadPdfInput {
  organizacion: { id: string; nombre: string };
  fechaDesde: string;
  fechaHasta: string;
  modo?: string;
  kpis: RentabilidadKpis;
  clientes: RentabilidadClienteRow[];
}

export async function generarRentabilidadPdf(input: RentabilidadPdfInput): Promise<void> {
  const scope = captureAuthOperationScope();
  const organizacionNombre = input.organizacion.nombre.trim();
  if (!organizacionNombre || !input.organizacion.id || scope.organizationId !== input.organizacion.id) {
    throw new Error("No se pudo identificar la organización del reporte.");
  }
  // P12: RentabilidadDocument se carga dinámicamente para no arrastrar @react-pdf en el bundle inicial.
  const { RentabilidadDocument } = await import("@/pdf/documents/RentabilidadDocument");
  scope.assertCurrent();
  await descargarPdf(
    <RentabilidadDocument {...input} organizacionNombre={organizacionNombre} />,
    `${slugifyOrg(organizacionNombre)}_rentabilidad-${input.fechaDesde}_${input.fechaHasta}`,
  );
}
