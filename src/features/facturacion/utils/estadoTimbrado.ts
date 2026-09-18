/**
 * O7 — Estado derivado del diálogo de timbrado (checks + fast path).
 * Se extrae del componente para mantener su complejidad ciclomática baja
 * y poder testear la política de "todo listo" sin renderizar el diálogo.
 */
import { buildChecksTimbrado, type CheckTimbrado } from "@/features/facturacion/utils/validarDatosTimbrado";
import {
  MSG_NO_OBJETO_PPD,
  ppdIncompatibleNoObjeto,
  type LineaNoObjeto,
} from "@/lib/financial/noObjetoFiscal";

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
  conceptos?: LineaNoObjeto[] | null,
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

  // P1 · Auditoría IVA — PPD + "No objeto de impuesto" (SAT 01) dejaría el cobro
  // sin REP (el complemento de pago no admite ObjetoImpDR=01). Se avisa aquí,
  // antes de timbrar; el servidor sigue siendo la autoridad (fail-closed).
  const ppdNoObjeto = ppdIncompatibleNoObjeto(seleccion.metodoPago, conceptos ?? []);
  const checksFinales = ppdNoObjeto
    ? [...checks, { ok: false, label: MSG_NO_OBJETO_PPD }]
    : checks;
  const puedeTimbrarFinal = puedeTimbrar && !ppdNoObjeto;

  const esFastPath =
    puedeTimbrarFinal && Boolean(factura.uso_cfdi && factura.forma_pago && factura.metodo_pago);

  return { checks: checksFinales, puedeTimbrar: puedeTimbrarFinal, esFastPath };
}
