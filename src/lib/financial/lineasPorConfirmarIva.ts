/**
 * P1 · Auditoría IVA — Detecta renglones heredados cuyo tratamiento fiscal está
 * "Por confirmar" pero a los que el cálculo AÚN aplica la tasa global de la
 * organización (por el flag legacy `aplica_iva=true` sin tasa explícita).
 *
 * El importe que ve el cliente parecería definitivo cuando en realidad nadie
 * clasificó la línea. Aquí sólo se DETECTA para poder avisar: no se infiere que
 * la línea sea gravada, exenta o no objeto, ni se recategoriza nada.
 */
import { resolverTasaConcepto } from "@/lib/financial/financialUtils";
import {
  etiquetaTratamientoFila,
  ETIQUETA_TRATAMIENTO_POR_CONFIRMAR,
  type FilaTratamiento,
} from "@/lib/financial/etiquetaTratamientoFila";

export const AVISO_IVA_POR_CONFIRMAR =
  "Hay renglones cuyo tratamiento de IVA está por confirmar: el importe con IVA que se muestra es " +
  "ESTIMADO (se calculó con la tasa general de la empresa). Clasifica cada renglón (16%, 8%, tasa 0%, " +
  "exento o no objeto) antes de tratar el total como definitivo.";

/** ¿Esta fila muestra "Por confirmar" pero el total ya trae IVA calculado? */
export function esLineaIvaPorConfirmar(fila: FilaTratamiento, tasaGlobal: number): boolean {
  if (etiquetaTratamientoFila(fila) !== ETIQUETA_TRATAMIENTO_POR_CONFIRMAR) return false;
  return resolverTasaConcepto(fila, tasaGlobal) > 0;
}

/** ¿Algún renglón del conjunto está en esa situación? */
export function hayLineasIvaPorConfirmar(
  filas: ReadonlyArray<FilaTratamiento> | null | undefined,
  tasaGlobal: number,
): boolean {
  return (filas ?? []).some((f) => esLineaIvaPorConfirmar(f, tasaGlobal));
}
