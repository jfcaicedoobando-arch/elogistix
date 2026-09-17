/**
 * Constantes, tipos y helpers puros del Catálogo de productos y servicios.
 * Separado del `.parts.tsx` para respetar `react-refresh/only-export-components`
 * (los `.tsx` deben exportar únicamente componentes).
 *
 * El tratamiento fiscal (incluido "No objeto de impuesto (SAT 01)") vive en
 * `@/lib/financial/tipoIvaSat`: aquí sólo se reexporta lo que consume la tabla.
 */
import {
  TIPO_IVA_LABEL_SAT,
  TIPO_IVA_LABEL_CORTO,
  TIPO_IVA_OPCIONES,
  tasaDefaultCatalogo,
  type TipoIvaSat,
} from "@/lib/financial/tipoIvaSat";

export type TipoIva = TipoIvaSat;

export interface Row {
  id: string;
  organization_id: string;
  patron: string;
  clave_sat: string;
  activo: boolean;
  tipo_iva: TipoIva;
  clave_unidad_sat: string;
  nombre_unidad: string | null;
}

export interface Draft {
  patron: string;
  clave_sat: string;
  activo: boolean;
  tipo_iva: TipoIva;
  clave_unidad_sat: string;
}

export const EMPTY_DRAFT: Draft = {
  patron: "", clave_sat: "", activo: true,
  tipo_iva: "gravado_16", clave_unidad_sat: "E48",
};

export const UNIDADES_SAT: Array<{ value: string; label: string }> = [
  { value: "E48", label: "E48 — Unidad de Servicio" },
  { value: "H87", label: "H87 — Pieza" },
  { value: "XPP", label: "XPP — Paquete" },
  { value: "KGM", label: "KGM — Kilogramo" },
  { value: "TNE", label: "TNE — Tonelada" },
  { value: "MTR", label: "MTR — Metro" },
  { value: "MTQ", label: "MTQ — Metro cúbico" },
  { value: "LTR", label: "LTR — Litro" },
  { value: "ACT", label: "ACT — Actividad" },
];

/** Opciones del selector de tratamiento fiscal (alta y edición). */
export const TIPO_IVA_OPCIONES_CATALOGO = TIPO_IVA_OPCIONES;

export const TIPO_IVA_LABEL: Record<TipoIva, string> = TIPO_IVA_LABEL_SAT;

export const TIPO_IVA_BADGE: Record<TipoIva, string> = TIPO_IVA_LABEL_CORTO;

export const TIPO_IVA_VARIANT: Record<TipoIva, "default" | "secondary" | "outline"> = {
  gravado_16: "default",
  gravado_8: "default",
  tasa_0: "secondary",
  exento: "outline",
  no_objeto: "outline",
};

export function tasaFromTipo(tipo: TipoIva): number | null {
  return tasaDefaultCatalogo(tipo);
}
