/**
 * Aliases de filas y tipos de dominio para Embarque.
 * Reemplaza los re-exports históricos desde `hooks/embarque/useEmbarques.ts`.
 *
 * @deprecated v12.6.0 — Los siguientes campos de `EmbarqueRow` quedaron en modo
 * legacy a partir del refactor "1 embarque ↔ N contenedores":
 *   - `contenedor`, `tipo_contenedor`: ahora viven en `embarque_contenedores`.
 *   - `peso_kg`, `volumen_m3`, `piezas`: totales sincronizados por trigger DB
 *     desde el primer contenedor hijo (orden ASC).
 *
 * No se eliminan todavía porque export, reportes y vistas de listado siguen
 * leyéndolos. Lectura escrita debe hacerse vía `useContenedoresEmbarque` y los
 * servicios en `src/services/embarque/contenedores/`.
 */
import type { Tables } from "@/integrations/supabase/types";

export type EmbarqueRow = Tables<"embarques">;
export type ConceptoVentaRow = Tables<"conceptos_venta">;
export type ConceptoCostoRow = Tables<"conceptos_costo">;
export type DocumentoEmbarqueRow = Tables<"documentos_embarque">;
export type NotaEmbarqueRow = Tables<"notas_embarque">;

/** Errores de validación del paso 1 del wizard de embarques. */
export interface EmbarqueValidationErrors {
  modo?: string;
  tipo?: string;
  clienteId?: string;
  incoterm?: string;
  descripcionMercancia?: string;
  tipoCarga?: string;
  pesoKg?: string;
  volumenM3?: string;
  piezas?: string;
  shipper?: string;
  consignatario?: string;
}
