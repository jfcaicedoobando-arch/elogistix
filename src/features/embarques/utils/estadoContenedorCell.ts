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

/**
 * MR-UI-03: el conteo SIEMPRE proviene de `embarque_contenedores`. Antes se
 * usaba como respaldo el número de embarques agrupados por expediente, así que
 * la etiqueta `+N` y su tooltip mostraban embarques, no contenedores.
 */
export function derivarEstadoContenedor(
  embarque: Pick<EmbarqueRow, "modo" | "bl_master" | "contenedor"> &
    Partial<Pick<EmbarqueRow, "tipo_carga">>,
  info?: ContenedorInfo,
): EstadoContenedorCell {
  const esLcl = esTipoCargaLcl(embarque.tipo_carga);
  const esMaritimo = embarque.modo === "Marítimo";
  const count = info?.count ?? (embarque.contenedor?.trim() ? 1 : 0);
  const primero = info?.primero || embarque.contenedor || "";
  // v13.823.332 · UX-EMB-01: los contenedores hijos sólo existen en marítimo.
  // En Aéreo/Terrestre no hay nada que capturar, así que nunca se marca
  // "Datos pendientes". En LCL el agente consolida y no comparte número/tipo.
  const incompletos = esMaritimo && !esLcl ? info?.incompletos ?? 0 : 0;

  const blFalta = esMaritimo && !embarque.bl_master?.trim();
  const pendientes = incompletos > 0 || blFalta;
  const pendientesTitle = tituloPendientes(blFalta, incompletos);
  return { count, primero, incompletos, blFalta, pendientes, pendientesTitle, esLcl };

}

