import type { ModoColumna } from "./estadoResultados";

/**
 * Mapea el `modo` crudo del embarque a una columna del EERR. Cualquier
 * modo no reconocido (Multimodal, vacío, mayúsculas, con acentos raros)
 * cae a "Otros" para que sus conceptos NO se pierdan silenciosamente —
 * antes eran descartados y hacían que "Utilidad operativa" no cuadrara
 * con "Ingresos del periodo".
 */
export function resolverModoColumna(modo: string): ModoColumna {
  const raw = (modo ?? "").trim();
  if (raw === "Marítimo" || raw === "Aéreo" || raw === "Terrestre") return raw;
  return "Otros";
}

/**
 * Clave canónica para colapsar filas del pivot. Ignora acentos, colapsa
 * espacios múltiples y normaliza mayúsculas — evita que "Flete Marítimo"
 * y "Flete Maritimo" o "THC" y "THC  " aparezcan como filas separadas.
 */
export function normalizeKey(desc: string): string {
  return (desc ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

