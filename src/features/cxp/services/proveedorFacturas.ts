/**
 * Services CxP — Cuentas por Pagar a proveedores.
 *
 * Lista facturas de proveedor con saldo calculado (vía v_proveedor_facturas_saldo),
 * KPIs (por pagar / vencido / por vencer 7d) y CRUD básico.
 *
 * Lógica pura (clasificación, mapeo, filtros cliente) en `./proveedorFacturas.helpers`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import {
  PROVEEDOR_FACTURAS_SELECT,
  mapJoinedRow,
  aplicarFiltrosCliente,
  type Joined,
} from "./proveedorFacturas.helpers";

export type ProveedorFacturaRow = Tables<"proveedor_facturas">;
export type EstadoProveedorFactura = ProveedorFacturaRow["estado"];
export type EstatusCxP = "Vigente" | "Por vencer" | "Vencida" | "Pagada" | "Sin saldo";

export interface FacturaCxP {
  id: string;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_origen: "Nacional" | "Extranjero" | null;
  embarque_id: string | null;
  folio_proveedor: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  moneda: ProveedorFacturaRow["moneda"];
  total: number;
  pagado: number;
  notas_credito: number;
  saldo: number;
  estado: EstadoProveedorFactura;
  estatus: EstatusCxP;
  tipo_cambio_usd: number;
  estado_aprobacion: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  categoria_presupuesto_id: string | null;
}

export interface FetchCxPFiltros {
  search?: string;
  proveedor_id?: string;
  moneda?: ProveedorFacturaRow["moneda"] | "todas";
  estatus?: EstatusCxP | "todos";
  origen?: "Nacional" | "Extranjero" | "todos";
  aprobacion?: "todos" | "pendiente" | "aprobada" | "rechazada";
  categoria_presupuesto_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export async function fetchFacturasCxP(filtros: FetchCxPFiltros = {}): Promise<FacturaCxP[]> {
  let q = supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .neq("estado", "Cancelada")
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
    .limit(2000);

  if (filtros.proveedor_id && filtros.proveedor_id !== "todos") q = q.eq("proveedor_id", filtros.proveedor_id);
  if (filtros.categoria_presupuesto_id && filtros.categoria_presupuesto_id !== "todas") {
    q = q.eq("categoria_presupuesto_id", filtros.categoria_presupuesto_id);
  }
  if (filtros.moneda && filtros.moneda !== "todas") q = q.eq("moneda", filtros.moneda);
  if (filtros.fecha_desde) q = q.gte("fecha_emision", filtros.fecha_desde);
  if (filtros.fecha_hasta) q = q.lte("fecha_emision", filtros.fecha_hasta);
  if (filtros.search) {
    q = q.or(`folio_proveedor.ilike.%${filtros.search}%,proveedor_nombre.ilike.%${filtros.search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  // SAFE-CAST: tipo `Joined` modela el shape del select con embeds; Supabase devuelve unknown.
  const rows = ((data as unknown as Joined[] | null) ?? []).map(mapJoinedRow);

  return aplicarFiltrosCliente(rows, filtros);
}

/**
 * Lee una factura individual con el mismo shape `FacturaCxP` que la lista.
 * Permite que el diálogo de detalle observe datos frescos vía React Query
 * aunque la lista filtrada haya descartado la fila (p.ej. al cambiar el
 * estado_aprobacion de "pendiente" a "aprobada" bajo el filtro "Por aprobar").
 */
export async function fetchFacturaProveedor(id: string): Promise<FacturaCxP | null> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select(PROVEEDOR_FACTURAS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // SAFE-CAST: mismo shape `Joined` validado por el select de arriba.
  return mapJoinedRow(data as unknown as Joined);
}

export { calcularKPIsCxP, type KPIsCxP } from "./cxpKpis";

export async function crearFacturaProveedor(payload: TablesInsert<"proveedor_facturas">) {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verifica si ya existe una factura con el mismo proveedor + folio + fecha emisión
 * (excluyendo canceladas y borradas). Bloquea capturas duplicadas accidentales.
 */
export async function existeFacturaDuplicada(
  proveedorId: string,
  folioProveedor: string,
  fechaEmision: string,
  excluirId?: string,
): Promise<boolean> {
  let q = supabase
    .from("proveedor_facturas")
    .select("id")
    .eq("proveedor_id", proveedorId)
    .eq("folio_proveedor", folioProveedor.trim())
    .eq("fecha_emision", fechaEmision)
    .neq("estado", "Cancelada")
    .is("deleted_at", null)
    .limit(1);
  if (excluirId) q = q.neq("id", excluirId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function softDeleteFacturaProveedor(id: string, userId: string | null) {
  const { error } = await supabase
    .from("proveedor_facturas")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Campos editables de una factura de proveedor. Excluye proveedor, CFDI fiscal,
 * embarque y campos computados (total/pagado/saldo) por integridad. El total se
 * recalcula aquí desde subtotal + iva − retenciones.
 */
export interface ActualizarFacturaPayload {
  folio_proveedor: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_credito: number;
  moneda: ProveedorFacturaRow["moneda"];
  tipo_cambio_usd: number;
  subtotal: number;
  iva: number;
  retenciones: number;
  categoria_presupuesto_id: string | null;
  notas: string;
}

export class SaldoNegativoError extends Error {
  code = "SALDO_NEGATIVO" as const;
  totalPagado: number;
  constructor(totalPagado: number) {
    super("El nuevo total no puede ser menor a lo ya pagado");
    this.totalPagado = totalPagado;
  }
}

/** Campos cuyo cambio fuerza re-aprobación si la factura estaba aprobada. */
const CAMPOS_SENSIBLES: Array<keyof ActualizarFacturaPayload> = [
  "folio_proveedor", "fecha_emision",
  "moneda", "tipo_cambio_usd",
  "subtotal", "iva", "retenciones",
];

export async function actualizarFacturaProveedor(
  id: string,
  payload: ActualizarFacturaPayload,
): Promise<ProveedorFacturaRow> {
  // 1) Lee factura actual para detectar cambios sensibles y obtener proveedor_id.
  const { data: actual, error: errActual } = await supabase
    .from("proveedor_facturas")
    .select("id, proveedor_id, estado_aprobacion, folio_proveedor, fecha_emision, moneda, tipo_cambio_usd, subtotal, iva, retenciones")
    .eq("id", id)
    .single();
  if (errActual) throw errActual;

  // 2) Duplicado (proveedor + folio + emisión) excluyendo self.
  const dup = await existeFacturaDuplicada(
    actual.proveedor_id, payload.folio_proveedor, payload.fecha_emision, id,
  );
  if (dup) {
    const err = new Error("Ya existe otra factura con este folio para este proveedor en esta fecha.") as Error & { code?: string };
    err.code = "DUPLICADO";
    throw err;
  }

  // 3) Validar que el nuevo total no quede por debajo de lo ya pagado.
  const nuevoTotal =
    (Number(payload.subtotal) || 0) +
    (Number(payload.iva) || 0) -
    (Number(payload.retenciones) || 0);
  const { data: pagos, error: errPagos } = await supabase
    .from("pagos_proveedor")
    .select("monto")
    .eq("factura_id", id);
  if (errPagos) throw errPagos;
  const totalPagado = (pagos ?? []).reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  // Tolerancia de 1 centavo por redondeos.
  if (nuevoTotal + 0.01 < totalPagado) throw new SaldoNegativoError(totalPagado);

  // 4) ¿Hubo cambio sensible? → re-aprobación si estaba aprobada.
  const sensibleCambio = CAMPOS_SENSIBLES.some((k) => {
    const a = (actual as Record<string, unknown>)[k as string];
    const b = (payload as Record<string, unknown>)[k as string];
    if (typeof a === "number" || typeof b === "number") return Number(a) !== Number(b);
    return a !== b;
  });
  const forzarReaprobacion = sensibleCambio && actual.estado_aprobacion === "aprobada";

  // 5) UPDATE.
  const updateBody: Partial<ProveedorFacturaRow> = {
    folio_proveedor: payload.folio_proveedor.trim(),
    fecha_emision: payload.fecha_emision,
    fecha_vencimiento: payload.fecha_vencimiento,
    dias_credito: payload.dias_credito,
    moneda: payload.moneda,
    tipo_cambio_usd: payload.tipo_cambio_usd,
    subtotal: payload.subtotal,
    iva: payload.iva,
    retenciones: payload.retenciones,
    total: nuevoTotal,
    categoria_presupuesto_id: payload.categoria_presupuesto_id,
    notas: payload.notas,
    updated_at: new Date().toISOString(),
  };
  if (forzarReaprobacion) {
    updateBody.estado_aprobacion = "pendiente";
    updateBody.aprobada_por = null;
    updateBody.aprobada_at = null;
  }

  const { data, error } = await supabase
    .from("proveedor_facturas")
    .update(updateBody)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
