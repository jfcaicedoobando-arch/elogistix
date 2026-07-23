/**
 * Constantes, tipos y helpers puros del Catálogo de productos y servicios.
 * Separado del `.parts.tsx` para respetar `react-refresh/only-export-components`
 * (los `.tsx` deben exportar únicamente componentes).
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";

export type TipoIva = "gravado_16" | "tasa_0" | "exento";

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

export const TIPO_IVA_LABEL: Record<TipoIva, string> = {
  gravado_16: "IVA 16%",
  tasa_0: "IVA 0%",
  exento: "Exento",
};

export const TIPO_IVA_VARIANT: Record<TipoIva, "default" | "secondary" | "outline"> = {
  gravado_16: "default",
  tasa_0: "secondary",
  exento: "outline",
};

export function tasaFromTipo(tipo: TipoIva): number | null {
  if (tipo === "gravado_16") return TASA_IVA;
  if (tipo === "tasa_0") return 0;
  return null;
}
