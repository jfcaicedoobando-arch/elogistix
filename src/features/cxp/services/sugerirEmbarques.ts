/**
 * Sugerencias de embarque para vincular una factura de proveedor cuando NO
 * hay conceptos_costo pendientes. Usa la RPC `sugerir_embarques_para_proveedor`
 * (SECURITY DEFINER) que rankea por:
 *   - Match directo por nombre en `embarques.agente/naviera/transportista/aerolinea` (100)
 *   - Tarifa aplicada → agente.proveedor_id (80)
 *   - Tarifa aplicada → naviera condiciones.proveedor_id (80)
 *
 * Además expone `buscarEmbarquesPorTexto` para el modo manual del UI.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Estados de embarque que NO pueden recibir costos nuevos desde una factura
 * de proveedor. Espejo del filtro de la RPC `sugerir_embarques_para_proveedor`
 * y del trigger `bloquear_conceptos_en_embarque_cerrado`.
 * `Entregado` y `Por liquidar` SÍ se permiten: todavía reciben facturas.
 */
export const ESTADOS_EMBARQUE_NO_VINCULABLES = ["Cerrado", "Cancelado"] as const;

/** Filtro PostgREST `in (...)` para los estados no vinculables. */
export const FILTRO_ESTADOS_NO_VINCULABLES =
  `(${ESTADOS_EMBARQUE_NO_VINCULABLES.join(",")})`;

/** `true` si el estado del embarque impide vincularle costos nuevos. */
export function esEstadoNoVinculable(estado: string | null | undefined): boolean {
  return !!estado && (ESTADOS_EMBARQUE_NO_VINCULABLES as readonly string[]).includes(estado);
}

export interface EmbarqueSugerido {
  embarque_id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  estado: string | null;
  etd: string | null;
  eta: string | null;
  match_tipo: string;
  score: number;
}

export async function sugerirEmbarquesParaProveedor(
  proveedorId: string,
  organizationId: string | null,
  limit = 10,
): Promise<EmbarqueSugerido[]> {
  if (!proveedorId || !organizationId) return [];
  const { data, error } = await supabase.rpc("sugerir_embarques_para_proveedor", {
    _proveedor_id: proveedorId,
    _organization_id: organizationId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as EmbarqueSugerido[];
}

export async function buscarEmbarquesPorTexto(
  q: string,
  organizationId: string | null,
  limit = 8,
): Promise<EmbarqueSugerido[]> {
  const term = q.trim();
  if (!term || !organizationId) return [];
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, cliente_nombre, estado, etd, eta, bl_master, bl_house")
    .eq("organization_id", organizationId)
    .or(
      `expediente.ilike.%${term}%,bl_master.ilike.%${term}%,bl_house.ilike.%${term}%,cliente_nombre.ilike.%${term}%`,
    )
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    embarque_id: r.id,
    expediente: r.expediente,
    cliente_nombre: r.cliente_nombre,
    estado: r.estado,
    etd: r.etd,
    eta: r.eta,
    match_tipo: "Búsqueda manual",
    score: 0,
  }));
}

interface CrearConceptoYVincularInput {
  facturaId: string;
  organizationId: string;
  embarqueId: string;
  proveedorId: string;
  proveedorNombre: string;
  concepto: string;
  monto: number;
  moneda: string;
  folio: string;
  fechaEmision: string;
}

/**
 * Crea un concepto_costo "ad-hoc" en el embarque y registra el vínculo con la
 * factura de proveedor. Marca el concepto como Pagado de una vez porque el
 * monto fue capturado contra la factura completa (no es presupuesto previo).
 */
export async function crearConceptoCostoYVincular(
  input: CrearConceptoYVincularInput,
): Promise<{ conceptoId: string }> {
  const { data: cc, error: errCc } = await supabase
    .from("conceptos_costo")
    .insert([{
      embarque_id: input.embarqueId,
      organization_id: input.organizationId,
      proveedor_id: input.proveedorId,
      proveedor_nombre: input.proveedorNombre,
      concepto: input.concepto,
      monto: input.monto,
      moneda: input.moneda as "MXN" | "USD" | "EUR",
      estado_liquidacion: "Pagado",
      fecha_pago: input.fechaEmision,
      referencia_pago: input.folio,
    }])
    .select("id")
    .single();
  if (errCc) throw errCc;

  const { error: errLink } = await supabase
    .from("proveedor_facturas_conceptos")
    .insert({
      proveedor_factura_id: input.facturaId,
      organization_id: input.organizationId,
      concepto_costo_id: cc.id,
      descripcion: input.concepto,
      cantidad: 1,
      monto: input.monto,
    });
  if (errLink) throw errLink;

  return { conceptoId: cc.id };
}
