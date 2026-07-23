/**
 * Lógica pura para derivar el estado visual de la celda "Contenedores"
 * en la tabla de embarques. Sin React ni Supabase: testeable de forma aislada.
 */

import type { EmbarqueRow } from "@/features/embarques/hooks";
import type { ContenedorInfo } from "@/features/embarques/table/embarqueColumns";

export interface EstadoContenedorCell {
  count: number;
  primero: string;
  incompletos: number;
  blFalta: boolean;
  pendientes: boolean;
  pendientesTitle: string;
  /** v13.127.1: en LCL el agente no siempre informa el contenedor físico. */
  esLcl: boolean;
}

function esTipoCargaLcl(tipoCarga: string | null | undefined): boolean {
  return !!tipoCarga && tipoCarga.trim().toUpperCase() === "LCL";
}

export function derivarEstadoContenedor(
  embarque: Pick<EmbarqueRow, "modo" | "bl_master" | "contenedor"> &
    Partial<Pick<EmbarqueRow, "tipo_carga">>,
  info?: ContenedorInfo,
  legacyCount?: number,
): EstadoContenedorCell {
  const esLcl = esTipoCargaLcl(embarque.tipo_carga);
  const count = info?.count ?? legacyCount ?? 1;
  const primero = info?.primero || embarque.contenedor || "";
  // En LCL los contenedores hijos no se exigen: el agente suele consolidar y
  // nunca nos comparte número/tipo. Forzamos incompletos=0 para no marcar
  // "Datos pendientes" en la tabla. BL Master sigue siendo obligatorio.
  const incompletos = esLcl ? 0 : info?.incompletos ?? 0;
  const blFalta =
    embarque.modo === "Marítimo" && (!embarque.bl_master || embarque.bl_master.trim() === "");
  const pendientes = incompletos > 0 || blFalta;
  const pendientesTitle = [
    blFalta ? "BL Master sin capturar" : null,
    incompletos > 0 ? `${incompletos} contenedor(es) sin número o tipo` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { count, primero, incompletos, blFalta, pendientes, pendientesTitle, esLcl };
}

