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
import { TASA_IVA, subtotalLinea, sumarMontos } from "@/lib/financial/financialUtils";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";
import { hoyMx } from "@/lib/date/mx";
import { registrarActividad } from "@/services/bitacora/registrar";

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
  moneda: "MXN" | "USD" | "EUR";
  tipoCambio: number;
  notas?: string;
  conceptos: ConceptoManualInput[];
  tasaIva: number;               // 0.16 por default
}

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return hoyMx(d);
}

function tasaAplicada(tipo: TipoIvaConcepto | undefined, tasaGlobal: number): number | null {
  const t = tipo ?? "gravado_16";
  if (t === "gravado_16") return tasaGlobal;
  if (t === "tasa_0") return 0;
  return null; // exento
}

/**
 * FIX-17 — folio borrador con entropía (Date + UUID) para evitar colisión
 * bajo carga concurrente. El prefijo `BORRADOR-` sigue siendo el marcador
 * que la UI usa para bloquear envío/descarga hasta el timbrado.
 */
function generarFolioBorrador(): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `BORRADOR-${Date.now().toString(36)}-${rand}`;
}

export async function crearFacturaManual(input: CrearFacturaManualInput): Promise<string> {
  if (input.conceptos.length === 0) {
    throw new Error("Debe haber al menos un concepto");
  }

  const tasa = input.tasaIva ?? TASA_IVA;

  // FIX-17 — validar cada concepto ANTES de tocar la BD y computar los
  // totales de línea con `subtotalLinea` para que el encabezado sea Σ
  // exacto de los renglones al centavo.
  const lineas = input.conceptos.map((c, idx) => {
    const cantidad = Number(c.cantidad);
    const precio = Number(c.precio_unitario);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`Concepto #${idx + 1} ("${c.descripcion || "sin descripción"}"): cantidad inválida (${c.cantidad}). Debe ser un número mayor a 0.`);
    }
    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error(`Concepto #${idx + 1} ("${c.descripcion || "sin descripción"}"): precio_unitario inválido (${c.precio_unitario}). Debe ser un número finito ≥ 0.`);
    }
    const cantidadEntera = Math.max(1, Math.round(cantidad));
    const totalLinea = subtotalLinea(cantidadEntera, precio);
    const tipo_iva: TipoIvaConcepto = c.tipo_iva ?? "gravado_16";
    const tasaFila = tasaAplicada(tipo_iva, tasa);
    const ivaLinea = tasaFila != null ? subtotalLinea(totalLinea, tasaFila) : 0;
    // α.1 — clave SAT obligatoria; se elimina el fallback silencioso "81141601".
    const clave = c.clave_sat?.trim();
    if (!clave) {
      throw new Error(`El concepto #${idx + 1} ("${c.descripcion || "sin descripción"}") no tiene clave SAT. Selecciona la clave correcta del catálogo SAT antes de crear la factura.`);
    }
    return {
      idx,
      descripcion: c.descripcion,
      cantidad: cantidadEntera,
      precio,
      totalLinea,
      ivaLinea,
      tipo_iva,
      tasaFila,
      clave,
    };
  });

  const subtotal = sumarMontos(lineas.map((l) => l.totalLinea));
  const iva = sumarMontos(lineas.map((l) => l.ivaLinea));
  const total = sumarMontos([subtotal, iva]);

  const numeroProvisional = generarFolioBorrador();

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
      subtotal,
      iva,
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

  const conceptosRows = lineas.map((l) => ({
    factura_id: facturaId,
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

  const { error: errConc } = await supabase
    .from("conceptos_factura")
    .insert(conceptosRows);
  if (errConc) {
    // rollback manual: borrar factura huérfana
    await supabase.from("facturas").delete().eq("id", facturaId);
    await registrarActividad({
      modulo: "facturacion",
      accion: "Eliminó factura borrador",
      entidadId: facturaId,
      entidadNombre: numeroProvisional,
      detalles: { motivo: "Rollback por error al crear conceptos" },
    });
    throw new Error(`Error al crear conceptos: ${errConc.message}`);
  }

  await registrarActividad({
    modulo: "facturacion",
    accion: "Creó factura manual borrador",
    entidadId: facturaId,
    entidadNombre: numeroProvisional,
    detalles: { cliente: input.clienteNombre, total, moneda: input.moneda },
  });
  return facturaId;
}
