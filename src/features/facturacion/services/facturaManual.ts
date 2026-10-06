/**
 * Servicio: facturas manuales (sin embarque/proforma).
 *
 * Crea una `factura` con `origen='manual'`, embarque_id/proforma_id en NULL,
 * y los renglones en `conceptos_factura`. La emisión vía Facturapi se hace
 * después con el flujo estándar (`emitirFacturapi`).
 *
 * Cada renglón puede llevar su propio régimen de IVA
 * (`gravado_16` | `tasa_0` | `exento`). Helpers puros en
 * `facturaManualLineas.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { TASA_IVA, sumarMontos } from "@/lib/financial/financialUtils";
import type { Json } from "@/integrations/supabase/types";
import type { Moneda } from "@/types/db";
import {
  construirLineasManuales,
  vencimiento,
  type ConceptoManualInput,
} from "@/features/facturacion/services/facturaManualLineas";

export type { ConceptoManualInput };

export interface CrearFacturaManualInput {
  /** Identidad estable de una captura, conservada en reintentos. */
  requestId?: string;
  organizationId: string;
  clienteId: string;
  clienteNombre: string;
  rfcCliente: string;
  serie: string;
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  diasCredito: number;
  fechaEmision: string;          // YYYY-MM-DD
  moneda: Moneda;
  tipoCambio: number;
  notas?: string;
  conceptos: ConceptoManualInput[];
  tasaIva: number;               // 0.16 por default
}

export async function crearFacturaManual(input: CrearFacturaManualInput): Promise<string> {
  if (input.conceptos.length === 0) {
    throw new Error("Debe haber al menos un concepto");
  }

  const tasa = input.tasaIva ?? TASA_IVA;
  const lineas = construirLineasManuales(input.conceptos, tasa);

  const subtotal = sumarMontos(lineas.map((l) => l.totalLinea));
  const iva = sumarMontos(lineas.map((l) => l.ivaLinea));
  const total = sumarMontos([subtotal, iva]);

  // B-11 — una factura con total $0 no es facturable (todos los conceptos en $0).
  if (total <= 0) {
    throw new Error("El total de la factura debe ser mayor a $0. Revisa los precios unitarios de los conceptos.");
  }

  const requestId = input.requestId ?? crypto.randomUUID();
  const numeroProvisional = `BORRADOR-${requestId}`;

  const factura = {
      numero: numeroProvisional,
      embarque_id: null,
      proforma_id: null,
      expediente: "",
      cliente_id: input.clienteId,
      cliente_nombre: input.clienteNombre,
      rfc_cliente: input.rfcCliente,
      subtotal,
      iva,
      total,
      moneda: input.moneda,
      tipo_cambio: input.tipoCambio,
      fecha_emision: input.fechaEmision,
      fecha_vencimiento: vencimiento(input.fechaEmision, input.diasCredito),
      estado: "Borrador",
      origen: "manual",
      serie: input.serie,
      uso_cfdi: input.usoCfdi,
      forma_pago: input.formaPago,
      metodo_pago: input.metodoPago,
      dias_credito: input.diasCredito,
      notas: input.notas ?? null,
      organization_id: input.organizationId,
  };

  const conceptosRows = lineas.map((l) => ({
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio,
    total: l.totalLinea,
    moneda: input.moneda,
    clave_sat: l.clave,
    organization_id: input.organizationId,
    tipo_iva: l.tipo_iva,
    tasa_iva_aplicada: l.tasaFila,
  }));

  const { data, error } = await supabase.rpc("crear_factura_manual_idempotente", {
    p_request_id: requestId,
    p_factura: factura as Json,
    p_conceptos: conceptosRows as Json,
  });
  if (error) throw new Error(`Error al crear factura: ${error.message}`);
  if (typeof data !== "string" || !data) throw new Error("La creación no devolvió el identificador de la factura.");
  return data;
}
