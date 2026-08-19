/**
 * Descripciones por módulo (facturación, cxp, costeo) — extraídas de
 * `bitacoraDescripcion.ts` para respetar Power of 10 (≤ 200 líneas).
 *
 * Ola 20 · paso 9: el despacho es una TABLA, no una escalera de `if`. Cada
 * acción es una fila del directorio; añadir una acción nueva es agregar un
 * renglón, no otra rama que el linter tenga que perdonar.
 */
import { formatCurrency } from "@/lib/formatters";
import type { DescripcionBitacora } from "./bitacoraDescripcion.types";

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

type Detalles = Record<string, unknown>;
/** Título fijo, o título + cómo derivar el contexto desde `detalles`. */
type Fila = string | { titulo: string; contexto: (d: Detalles) => string | undefined };

function resolver(tabla: Record<string, Fila>, accion: string, detalles: Detalles) {
  const fila = tabla[accion];
  if (fila === undefined) return null;
  if (typeof fila === "string") return { titulo: fila };
  return { titulo: fila.titulo, contexto: fila.contexto(detalles) };
}

const FACTURACION: Record<string, Fila> = {
  facturapi_emitida: {
    titulo: "Timbró factura",
    contexto: (d) => {
      const uuid = asString(d.uuid);
      return uuid ? `UUID ${uuid.slice(0, 8)}…` : undefined;
    },
  },
  facturapi_cancelacion_solicitada: {
    titulo: "Solicitó cancelación de factura",
    contexto: (d) => asString(d.motivo),
  },
  cfdi_enviado: { titulo: "Envió CFDI por email", contexto: (d) => asString(d.email) },
  "factura.borrador_generado": "Generó borrador de factura",
  "factura.borrador_eliminado": "Eliminó borrador de factura",
  factura_duplicada_para_sustitucion: "Generó borrador de sustitución",
  facturapi_consulta_reconciliada: "Reconciliación con FacturApi",
  facturapi_cancelada: "Canceló factura",
  facturapi_cancelar_failed: "Falló cancelación de factura",
  facturapi_sustituida: "Sustituyó factura",
  facturapi_nc_emitida: "Emitió nota de crédito",
  facturapi_nc_cancelada: "Canceló nota de crédito",
  facturapi_rep_emitido: "Timbró complemento de pago",
  facturapi_rep_cancelado: "Canceló complemento de pago",
  cfdi_envio_failed: "Falló envío de CFDI",
  facturapi_emitir_failed: "Falló timbrado de factura",
};

const CXP: Record<string, Fila> = {
  pagar: {
    titulo: "Registró pago a proveedor",
    contexto: (d) => {
      const monto = asNumber(d.monto);
      return monto === undefined ? undefined : formatCurrency(monto, asString(d.moneda) ?? "MXN");
    },
  },
  cancelar: { titulo: "Canceló factura de proveedor", contexto: (d) => asString(d.motivo) },
  eliminar_pago: "Eliminó pago a proveedor",
  crear_nota_credito: "Registró nota de crédito de proveedor",
  aplicar_nota_credito: "Aplicó nota de crédito",
  cancelar_nota_credito: "Canceló nota de crédito",
};

const COSTEO: Record<string, Fila> = {
  crear: { titulo: "Creó tarifa", contexto: (d) => asString(d.entidad_nombre) },
  editar: "Editó tarifa",
  eliminar: "Eliminó tarifa",
  reemplazar: "Marcó tarifa como reemplazada",
};

export function describirFacturacion(
  accion: string,
  detalles: Detalles,
): DescripcionBitacora | null {
  return resolver(FACTURACION, accion, detalles);
}

export function describirCxp(accion: string, detalles: Detalles): DescripcionBitacora | null {
  return resolver(CXP, accion, detalles);
}

export function describirCosteo(
  accion: string,
  entidad_nombre?: string | null,
): DescripcionBitacora | null {
  return resolver(COSTEO, accion, { entidad_nombre: entidad_nombre ?? undefined });
}
