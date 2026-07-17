/**
 * Descripciones por módulo (facturación, cxp, costeo) — extraídas de
 * `bitacoraDescripcion.ts` para respetar Power of 10 (≤ 200 líneas).
 */
import { formatCurrency } from "@/lib/formatters";
import type { DescripcionBitacora } from "./bitacoraDescripcion.types";

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// eslint-disable-next-line complexity -- despacho lineal por accion.
export function describirFacturacion(
  accion: string,
  detalles: Record<string, unknown>,
): DescripcionBitacora | null {
  if (accion === "facturapi_emitida") {
    const uuid = asString(detalles.uuid);
    return { titulo: "Timbró factura", contexto: uuid ? `UUID ${uuid.slice(0, 8)}…` : undefined };
  }
  if (accion === "factura.borrador_generado") return { titulo: "Generó borrador de factura" };
  if (accion === "factura.borrador_eliminado") return { titulo: "Eliminó borrador de factura" };
  if (accion === "factura_duplicada_para_sustitucion") return { titulo: "Generó borrador de sustitución" };
  if (accion === "facturapi_cancelacion_solicitada") {
    return { titulo: "Solicitó cancelación de factura", contexto: asString(detalles.motivo) };
  }
  if (accion === "facturapi_consulta_reconciliada") return { titulo: "Reconciliación con FacturApi" };
  if (accion === "facturapi_cancelada") return { titulo: "Canceló factura" };
  if (accion === "facturapi_cancelar_failed") return { titulo: "Falló cancelación de factura" };
  if (accion === "facturapi_sustituida") return { titulo: "Sustituyó factura" };
  if (accion === "facturapi_nc_emitida") return { titulo: "Emitió nota de crédito" };
  if (accion === "facturapi_nc_cancelada") return { titulo: "Canceló nota de crédito" };
  if (accion === "facturapi_rep_emitido") return { titulo: "Timbró complemento de pago" };
  if (accion === "facturapi_rep_cancelado") return { titulo: "Canceló complemento de pago" };
  if (accion === "cfdi_enviado") return { titulo: "Envió CFDI por email", contexto: asString(detalles.email) };
  if (accion === "cfdi_envio_failed") return { titulo: "Falló envío de CFDI" };
  if (accion === "facturapi_emitir_failed") return { titulo: "Falló timbrado de factura" };
  return null;
}

export function describirCxp(
  accion: string,
  detalles: Record<string, unknown>,
): DescripcionBitacora | null {
  if (accion === "pagar") {
    const monto = asNumber(detalles.monto);
    const moneda = asString(detalles.moneda) ?? "MXN";
    return {
      titulo: "Registró pago a proveedor",
      contexto: monto !== undefined ? formatCurrency(monto, moneda) : undefined,
    };
  }
  if (accion === "cancelar") return { titulo: "Canceló factura de proveedor", contexto: asString(detalles.motivo) };
  if (accion === "eliminar_pago") return { titulo: "Eliminó pago a proveedor" };
  if (accion === "crear_nota_credito") return { titulo: "Registró nota de crédito de proveedor" };
  if (accion === "aplicar_nota_credito") return { titulo: "Aplicó nota de crédito" };
  if (accion === "cancelar_nota_credito") return { titulo: "Canceló nota de crédito" };
  return null;
}

export function describirCosteo(
  accion: string,
  entidad_nombre?: string | null,
): DescripcionBitacora | null {
  if (accion === "crear") return { titulo: "Creó tarifa", contexto: entidad_nombre || undefined };
  if (accion === "editar") return { titulo: "Editó tarifa" };
  if (accion === "eliminar") return { titulo: "Eliminó tarifa" };
  if (accion === "reemplazar") return { titulo: "Marcó tarifa como reemplazada" };
  return null;
}
