/**
 * Constantes compartidas por wizards (Embarque y Cotización).
 * Centralizadas aquí para evitar duplicación en componentes UI.
 */
import type { Enums } from "@/integrations/supabase/types";

export type ModoTransporte = Enums<"modo_transporte">;
export type TipoOperacion = Enums<"tipo_operacion">;
export type Incoterm = Enums<"incoterm">;

export const MODOS: ModoTransporte[] = ["Marítimo", "Aéreo", "Terrestre", "Multimodal"];
export const TIPOS: TipoOperacion[] = ["Importación", "Exportación", "Nacional", "Cross Trade", "Intra USA"];
export const INCOTERMS: Incoterm[] = ["EXW", "FOB", "CIF", "DAP", "DDP", "FCA", "CFR", "CPT", "CIP", "DAT", "N/A"];

export const UNIDADES_MEDIDA = [
  "BL",
  "W/M",
  "Documento",
  "Contenedor",
  "Kilo",
  "Embarque",
  "Pallet",
  "Caja",
] as const;


