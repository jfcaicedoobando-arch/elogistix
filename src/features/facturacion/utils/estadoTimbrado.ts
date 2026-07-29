/**
 * O7 — Estado derivado del diálogo de timbrado (checks + fast path).
 * Se extrae del componente para mantener su complejidad ciclomática baja
 * y poder testear la política de "todo listo" sin renderizar el diálogo.
 */
import { buildChecksTimbrado, type CheckTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";

interface FacturaLike {
  rfc_cliente?: string | null;
  moneda?: string | null;
  tipo_cambio?: number | string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
}

interface ClienteLike {
  rfc?: string | null;
  codigo_postal?: string | null;
  regimen_fiscal?: string | null;
}

interface SeleccionTimbrado {
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
}

export interface EstadoTimbrado {
  checks: CheckTimbrado[];
  puedeTimbrar: boolean;
  esFastPath: boolean;
}

export function buildEstadoTimbrado(
  factura: FacturaLike,
  cliente: ClienteLike | null | undefined,
  seleccion: SeleccionTimbrado,
): EstadoTimbrado {
  const { checks, puedeTimbrar } = buildChecksTimbrado({
    rfc: cliente?.rfc ?? factura.rfc_cliente ?? "",
    cp: cliente?.codigo_postal ?? "",
    regimen: cliente?.regimen_fiscal ?? "",
    usoCfdi: seleccion.usoCfdi,
    formaPago: seleccion.formaPago,
    metodoPago: seleccion.metodoPago,
    moneda: factura.moneda ?? "MXN",
    tipoCambio: factura.tipo_cambio == null ? null : Number(factura.tipo_cambio),
  });

  const esFastPath =
    puedeTimbrar && Boolean(factura.uso_cfdi && factura.forma_pago && factura.metodo_pago);

  return { checks, puedeTimbrar, esFastPath };
}
