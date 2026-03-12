import { useConfigValue } from "@/hooks/useConfiguracion";
import { TASA_IVA } from "@/lib/financialUtils";

/**
 * Lee la tasa de IVA desde la tabla de configuración (facturacion.tasa_iva).
 * El valor en BD se almacena como entero (ej. 16), se retorna como decimal (0.16).
 * Fallback: constante TASA_IVA de financialUtils.
 */
export function useTasaIVA(): number {
  const tasaPorcentaje = useConfigValue<number>("facturacion", "tasa_iva", TASA_IVA * 100);
  return tasaPorcentaje / 100;
}
