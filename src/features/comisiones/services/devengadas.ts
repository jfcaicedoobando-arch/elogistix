/**
 * Servicio de comisiones devengadas: lectura + KPIs por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ymMx } from "@/lib/date/mx";
import { fetchAvailableUsers } from "@/features/admin/services/usuario/availableUsers";

export type ComisionDevengadaRow = Tables<"comisiones_devengadas">;
export type EstadoComision = ComisionDevengadaRow["estado"];

export interface ComisionDevengada {
  id: string;
  organization_id: string;
  pago_factura_id: string;
  embarque_id: string | null;
  factura_id: string;
  vendedora_id: string | null;
  vendedora_nombre: string | null;
  factura_numero: string | null;
  cliente_nombre: string | null;
  expediente: string | null;
  monto_cobrado_mxn: number;
  utilidad_prorrateada_mxn: number;
  porcentaje_aplicado: number;
  comision_mxn: number;
  estado: EstadoComision;
  liquidacion_id: string | null;
  nota: string | null;
  created_at: string;
}

export interface FetchComisionesFiltros {
  vendedora_id?: string | "todas";
  periodo?: string;
  estado?: EstadoComision | "todos";
}

type Joined = ComisionDevengadaRow & {
  facturas: { numero: string; cliente_nombre: string; expediente: string | null } | null;
};

/**
 * B4 (Ola 7): los nombres/correos de las vendedoras no viven en una tabla
 * (se resuelven vía edge function `user-management`). Se resuelven en un solo
 * viaje y de forma best-effort: si falla, la columna muestra "—".
 */
async function buildNombreVendedoraMap(ids: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return {};
  try {
    const users = await fetchAvailableUsers();
    const map: Record<string, string> = {};
    for (const u of users) {
      if (unicos.includes(u.id)) map[u.id] = u.email;
    }
    return map;
  } catch {
    return {};
  }
}

export async function fetchComisionesDevengadas(
  filtros: FetchComisionesFiltros = {},
): Promise<ComisionDevengada[]> {
  let q = supabase
    .from("comisiones_devengadas")
    .select(`
      id, organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, liquidacion_id, nota, created_at,
      facturas:factura_id ( numero, cliente_nombre, expediente )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filtros.vendedora_id && filtros.vendedora_id !== "todas") {
    q = q.eq("vendedora_id", filtros.vendedora_id);
  }
  if (filtros.estado && filtros.estado !== "todos") {
    q = q.eq("estado", filtros.estado);
  }

  const { data, error } = await q;
  if (error) throw error;

  // SAFE-CAST: `Joined` modela el shape del embed; Supabase devuelve unknown.
  const crudas = (data as unknown as Joined[] | null) ?? [];
  const nombres = await buildNombreVendedoraMap(
    crudas.map((r) => r.vendedora_id).filter((id): id is string => !!id),
  );

  const rows = crudas.map((r): ComisionDevengada => ({
    id: r.id,
    organization_id: r.organization_id,
    pago_factura_id: r.pago_factura_id,
    embarque_id: r.embarque_id,
    factura_id: r.factura_id,
    vendedora_id: r.vendedora_id,
    vendedora_nombre: r.vendedora_id ? (nombres[r.vendedora_id] ?? null) : null,
    factura_numero: r.facturas?.numero ?? null,
    cliente_nombre: r.facturas?.cliente_nombre ?? null,
    expediente: r.facturas?.expediente ?? null,
    monto_cobrado_mxn: Number(r.monto_cobrado_mxn),
    utilidad_prorrateada_mxn: Number(r.utilidad_prorrateada_mxn),
    porcentaje_aplicado: Number(r.porcentaje_aplicado),
    comision_mxn: Number(r.comision_mxn),
    estado: r.estado,
    liquidacion_id: r.liquidacion_id,
    nota: r.nota,
    created_at: r.created_at,
  }));

  if (filtros.periodo) {
    // A11: el periodo se compara en zona CDMX; `.slice(0,7)` usaba el mes UTC
    // y entre 18:00–23:59 CDMX clasificaba la comisión en el mes equivocado.
    return rows.filter((r) => ymMx(new Date(r.created_at)) === filtros.periodo);
  }
  return rows;
}

export interface KPIsComisiones {
  devengado_mes_mxn: number;
  pendiente_liquidar_mxn: number;
  liquidado_mes_mxn: number;
}

export function calcularKPIsComisiones(items: ComisionDevengada[]): KPIsComisiones {
  const mesActual = ymMx();
  let dev = 0, pend = 0, liq = 0;
  for (const it of items) {
    const mes = ymMx(new Date(it.created_at));
    if (mes === mesActual && it.estado !== "Cancelada") dev += it.comision_mxn;
    if (it.estado === "Devengada") pend += it.comision_mxn;
    if (it.estado === "Liquidada" && mes === mesActual) liq += it.comision_mxn;
  }
  return {
    devengado_mes_mxn: dev,
    pendiente_liquidar_mxn: pend,
    liquidado_mes_mxn: liq,
  };
}
