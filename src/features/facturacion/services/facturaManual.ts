/**
 * Servicio: facturas manuales (sin embarque/proforma).
 *
 * Crea una `factura` con `origen='manual'`, embarque_id/proforma_id en NULL,
 * y los renglones en `conceptos_factura`. La emisión vía Facturapi se hace
 * después con el flujo estándar (`emitirFacturapi`).
 *
 * Cada renglón puede llevar su propio régimen de IVA
 * (`gravado_16` | `tasa_0` | `exento`).
 */
import { supabase } from "@/integrations/supabase/client";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

export interface ConceptoManualInput {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string;
  tipo_iva?: TipoIvaConcepto;
}

export interface CrearFacturaManualInput {
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
  moneda: "MXN" | "USD";
  tipoCambio: number;
  notas?: string;
  conceptos: ConceptoManualInput[];
  tasaIva: number;               // 0.16 por default
}

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function tasaAplicada(tipo: TipoIvaConcepto | undefined, tasaGlobal: number): number | null {
  const t = tipo ?? "gravado_16";
  if (t === "gravado_16") return tasaGlobal;
  if (t === "tasa_0") return 0;
  return null; // exento
}

export async function crearFacturaManual(input: CrearFacturaManualInput): Promise<string> {
  if (input.conceptos.length === 0) {
    throw new Error("Debe haber al menos un concepto");
  }

  const tasa = input.tasaIva ?? TASA_IVA;
  let subtotal = 0;
  let iva = 0;
  for (const c of input.conceptos) {
    const importe = Number(c.cantidad) * Number(c.precio_unitario);
    subtotal += importe;
    const t = tasaAplicada(c.tipo_iva, tasa);
    if (t != null) iva += importe * t;
  }
  const subtotalR = Math.round(subtotal * 100) / 100;
  const ivaR = Math.round(iva * 100) / 100;
  const total = Math.round((subtotalR + ivaR) * 100) / 100;

  // Número provisional. La serie/folio real se asignan al timbrar en Facturapi.
  const numeroProvisional = `MAN-${Date.now().toString().slice(-8)}`;

  const { data: factura, error: errFact } = await supabase
    .from("facturas")
    .insert({
      numero: numeroProvisional,
      embarque_id: null,
      proforma_id: null,
      expediente: "",
      cliente_id: input.clienteId,
      cliente_nombre: input.clienteNombre,
      rfc_cliente: input.rfcCliente,
      subtotal: subtotalR,
      iva: ivaR,
      total,
      moneda: input.moneda,
      tipo_cambio: input.tipoCambio,
      fecha_emision: input.fechaEmision,
      fecha_vencimiento: addDays(input.fechaEmision, input.diasCredito),
      estado: "Borrador",
      origen: "manual",
      serie: input.serie,
      uso_cfdi: input.usoCfdi,
      forma_pago: input.formaPago,
      metodo_pago: input.metodoPago,
      dias_credito: input.diasCredito,
      notas: input.notas ?? null,
      organization_id: input.organizationId,
    })
    .select("id")
    .single();
  if (errFact) throw new Error(`Error al crear factura: ${errFact.message}`);
  const facturaId = factura.id as string;

  const conceptosRows = input.conceptos.map((c) => {
    const cantidad = Math.max(1, Math.round(Number(c.cantidad)));
    const precio = Number(c.precio_unitario);
    const tipo_iva: TipoIvaConcepto = c.tipo_iva ?? "gravado_16";
    return {
      factura_id: facturaId,
      descripcion: c.descripcion,
      cantidad,
      precio_unitario: precio,
      total: Math.round(cantidad * precio * 100) / 100,
      moneda: input.moneda,
      clave_sat: c.clave_sat?.trim() || "81141601",
      organization_id: input.organizationId,
      tipo_iva,
      tasa_iva_aplicada: tasaAplicada(tipo_iva, tasa),
    };
  });

  const { error: errConc } = await supabase
    .from("conceptos_factura")
    .insert(conceptosRows);
  if (errConc) {
    // rollback manual: borrar factura huérfana
    await supabase.from("facturas").delete().eq("id", facturaId);
    throw new Error(`Error al crear conceptos: ${errConc.message}`);
  }

  return facturaId;
}
