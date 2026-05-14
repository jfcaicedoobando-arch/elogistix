/**
 * Aliases de filas y tipos de dominio para Embarque.
 * Reemplaza los re-exports históricos desde `hooks/embarque/useEmbarques.ts`.
 */
import type { Tables } from "@/integrations/supabase/types";

export type EmbarqueRow = Tables<"embarques">;
export type ConceptoVentaRow = Tables<"conceptos_venta">;
export type ConceptoCostoRow = Tables<"conceptos_costo">;
export type DocumentoEmbarqueRow = Tables<"documentos_embarque">;
export type NotaEmbarqueRow = Tables<"notas_embarque">;
