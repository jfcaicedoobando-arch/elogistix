/**
 * Lógica pura para derivar el estado visual de la celda "Contenedores"
 * en la tabla de embarques. Sin React ni Supabase: testeable de forma aislada.
 */

import type { EmbarqueRow } from "@/features/embarques/hooks";
import type { ContenedorInfo } from "@/features/embarques/components/embarqueColumns";

export interface EstadoContenedorCell {
  count: number;
  primero: string;
  incompletos: number;
  blFalta: boolean;
  pendientes: boolean;
  pendientesTitle: string;
}

export function derivarEstadoContenedor(
  embarque: Pick<EmbarqueRow, "modo" | "bl_master" | "contenedor">,
  info?: ContenedorInfo,
  legacyCount?: number,
): EstadoContenedorCell {
  const count = info?.count ?? legacyCount ?? 1;
  const primero = info?.primero || embarque.contenedor || "";
  const incompletos = info?.incompletos ?? 0;
  const blFalta =
    embarque.modo === "Marítimo" && (!embarque.bl_master || embarque.bl_master.trim() === "");
  const pendientes = incompletos > 0 || blFalta;
  const pendientesTitle = [
    blFalta ? "BL Master sin capturar" : null,
    incompletos > 0 ? `${incompletos} contenedor(es) sin número o tipo` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { count, primero, incompletos, blFalta, pendientes, pendientesTitle };
}
