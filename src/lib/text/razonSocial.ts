/**
 * Razón social estandarizada (MAYÚSCULAS), igual que la Constancia de
 * Situación Fiscal del SAT. Se conservan acentos y se colapsan espacios.
 *
 * La base de datos también lo aplica con un trigger; esto es la capa de UI
 * para que lo que se ve sea lo que se guarda.
 */
export function normalizarRazonSocial(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("es-MX");
}
