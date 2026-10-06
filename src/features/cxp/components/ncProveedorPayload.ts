import type { MonedaNotaCreditoProveedor, MotivoNotaCreditoProveedor } from "../types";

interface DatosNcProveedor {
  facturaId: string;
  folio: string;
  fecha: string;
  monto: number;
  subtotal: number;
  moneda: MonedaNotaCreditoProveedor;
  monedaFactura: MonedaNotaCreditoProveedor;
  tipoCambio: number | null;
  motivo: MotivoNotaCreditoProveedor;
  descripcion: string;
  uuidFiscal: string | null;
}

/** Persiste base neta, crédito nominal y valuación sin confundir sus monedas. */
export function construirNcProveedorPayload(datos: DatosNcProveedor) {
  return {
    proveedor_factura_id: datos.facturaId,
    folio_nc: datos.folio.trim(),
    fecha: datos.fecha,
    monto: datos.monto,
    subtotal: datos.subtotal,
    tipo_cambio_mxn: datos.moneda === "MXN" ? 1 : datos.tipoCambio,
    moneda: datos.moneda,
    tipo_cambio: datos.moneda === datos.monedaFactura ? null : datos.tipoCambio,
    motivo: datos.motivo,
    descripcion: datos.descripcion,
    estado: "Borrador" as const,
    uuid_fiscal: datos.uuidFiscal,
  };
}
