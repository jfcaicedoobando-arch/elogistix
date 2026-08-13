/**
 * Derivaciones puras del asistente de refacturación (normalización de pagos y
 * del receptor destino). Se extraen del hook para acotar su complejidad.
 */
import type { PagoRefacturacion } from "@/features/facturacion/domain/refacturacionPasos";

type PagoCrudo = {
  id: string;
  fecha_pago: string;
  monto: number | string;
  moneda: string;
  monto_aplicado_factura: number | string | null;
  uuid_rep?: string | null;
  estado_rep?: string | null;
  rep_cancelado_en?: string | null;
  rep_cancellation_status?: string | null;
};

export type ReceptorDestino = {
  nombre: string;
  rfc: string | null;
  regimen_fiscal: string | null;
  codigo_postal: string | null;
};

type ClienteFiscal = ReceptorDestino & { id: string };

/** Normaliza montos y campos de REP de los pagos del caso. */
export function mapearPagos(pagos: PagoCrudo[]): PagoRefacturacion[] {
  return pagos.map((p) => ({
    id: p.id,
    fecha_pago: p.fecha_pago,
    monto: Number(p.monto),
    moneda: p.moneda,
    monto_aplicado_factura:
      p.monto_aplicado_factura === null ? null : Number(p.monto_aplicado_factura),
    uuid_rep: p.uuid_rep ?? null,
    estado_rep: p.estado_rep ?? null,
    rep_cancelado_en: p.rep_cancelado_en ?? null,
    rep_cancellation_status: p.rep_cancellation_status ?? null,
  })) as PagoRefacturacion[];
}

/** Extrae los datos fiscales del cliente destino elegido. */
export function receptorDesdeClientes(
  clientes: ClienteFiscal[] | undefined,
  clienteDestinoId: string | null,
): ReceptorDestino | null {
  const c = clientes?.find((x) => x.id === clienteDestinoId);
  if (!c) return null;
  return {
    nombre: c.nombre,
    rfc: c.rfc,
    regimen_fiscal: c.regimen_fiscal,
    codigo_postal: c.codigo_postal,
  };
}

/** Nombre legible del cliente destino para textos de confirmación. */
export function nombreClienteDestino(
  clientes: ClienteFiscal[] | undefined,
  clienteDestinoId: string | null,
): string {
  return receptorDesdeClientes(clientes, clienteDestinoId)?.nombre ?? "el cliente destino";
}

export type OrdenanteSugerido = {
  nombre: string;
  rfc: string;
  /** De dónde salió la sugerencia, para explicarlo en la UI. */
  origen: "factura_nueva" | "cliente_destino";
  /** Folio de la factura viva cuando el origen es la factura nueva. */
  numeroFactura: string | null;
};

/**
 * Ordenante real del depósito: es el receptor de la factura viva (la nueva),
 * porque la original y su REP se cancelaron para ser sustituidos.
 */
export function ordenanteSugerido(
  facturaNueva: { numero: string; cliente_nombre: string | null; rfc_cliente: string | null } | null,
  receptorDestino: ReceptorDestino | null,
): OrdenanteSugerido | null {
  const nombreFactura = (facturaNueva?.cliente_nombre ?? "").trim();
  if (nombreFactura) {
    return {
      nombre: nombreFactura,
      rfc: (facturaNueva?.rfc_cliente ?? "").trim().toUpperCase(),
      origen: "factura_nueva",
      numeroFactura: facturaNueva?.numero ?? null,
    };
  }
  const nombreDestino = (receptorDestino?.nombre ?? "").trim();
  if (nombreDestino) {
    return {
      nombre: nombreDestino,
      rfc: (receptorDestino?.rfc ?? "").trim().toUpperCase(),
      origen: "cliente_destino",
      numeroFactura: null,
    };
  }
  return null;
}
