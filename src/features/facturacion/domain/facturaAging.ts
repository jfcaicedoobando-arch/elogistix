/**
 * Aging de mora para el detalle de factura CxC. Re-exporta el canon compartido
 * (`@/lib/domain/facturaDiasVencido`) para que otras features no importen
 * `facturacion/domain` directamente.
 */
export { calcularDiasVencidoFactura } from "@/lib/domain/facturaDiasVencido";

/**
 * Determina si el botón "Enviar recordatorio" debe mostrarse: sólo con
 * saldo pendiente y factura vigente (no cancelada/sustituida). El permiso
 * de cobranza (`canRegistrarCobro`) se evalúa fuera de este helper.
 */
export function puedeEnviarRecordatorio(params: {
  saldo: number;
  estaCancelada: boolean;
}): boolean {
  return !params.estaCancelada && params.saldo > 0.01;
}
