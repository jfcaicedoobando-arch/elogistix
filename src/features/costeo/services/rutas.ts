/**
 * Servicio: CRUD de rutas de costeo (par puerto origen → puerto destino).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoRuta } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";
import { registrarActividad } from "@/services/bitacora/registrar";

interface RawTarifaAggregate {
  estado: string;
  vigente_hasta: string | null;
  updated_at: string | null;
  agente_id: string | null;
}

interface RawRuta extends CosteoRuta {
  puerto_origen?: { name: string } | null;
  puerto_destino?: { name: string } | null;
  costeo_tarifas?: RawTarifaAggregate[] | null;
}

export async function fetchCosteoRutas(organizationId: string): Promise<CosteoRuta[]> {
  const { data, error } = await supabase
    .from("costeo_rutas")
    .select(
      "*, puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name), puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name), costeo_tarifas!costeo_tarifas_ruta_id_fkey(estado,vigente_hasta,updated_at,agente_id)",
    )
    .eq("organization_id", organizationId);
  if (error) throw error;
  const hoyIso = todayLocalISO();
  return ((data ?? []) as RawRuta[]).map((r) => {
    const vigentes = (r.costeo_tarifas ?? []).filter(
      (t) => t.estado === "vigente" && (!t.vigente_hasta || t.vigente_hasta >= hoyIso),
    );
    const fechasFin = vigentes
      .map((t) => t.vigente_hasta)
      .filter((d): d is string => !!d)
      .sort();
    const updates = vigentes
      .map((t) => t.updated_at)
      .filter((d): d is string => !!d)
      .sort();
    const agentes = new Set(vigentes.map((t) => t.agente_id).filter(Boolean));
    return {
      ...r,
      puerto_origen_nombre: r.puerto_origen?.name,
      puerto_destino_nombre: r.puerto_destino?.name,
      tarifas_vigentes_count: vigentes.length,
      proxima_expiracion: fechasFin[0] ?? null,
      ultima_actualizacion_tarifa: updates[updates.length - 1] ?? null,
      proveedores_count: agentes.size,
    };
  });
}


export interface CosteoRutaInput {
  puerto_origen_id: string;
  puerto_destino_id: string;
  activa?: boolean;
}

export class CosteoRutaDuplicadaError extends Error {
  constructor() {
    super("Esta ruta CN → MX ya está registrada en tu organización.");
    this.name = "CosteoRutaDuplicadaError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "23505" || candidate.code === 23505) return true;
  const msg = String(candidate.message ?? "");
  return /costeo_rutas.*puerto/i.test(msg) || /duplicate key/i.test(msg);
}

async function nombreRuta(puertoOrigenId: string, puertoDestinoId: string): Promise<string> {
  const { data } = await supabase
    .from("puertos")
    .select("id, name")
    .in("id", [puertoOrigenId, puertoDestinoId]);
  const porId = new Map((data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  return `${porId.get(puertoOrigenId) ?? puertoOrigenId} → ${porId.get(puertoDestinoId) ?? puertoDestinoId}`;
}

export async function insertCosteoRuta(
  organizationId: string,
  input: CosteoRutaInput,
): Promise<CosteoRuta> {
  const { data, error } = await supabase
    .from("costeo_rutas")
    .insert({ ...input, organization_id: organizationId })
    .select("*")
    .single();
  if (error) {
    if (isUniqueViolation(error)) throw new CosteoRutaDuplicadaError();
    throw error;
  }
  const ruta = data as CosteoRuta;
  await registrarActividad({
    modulo: "costeo",
    accion: "crear_ruta_costeo",
    entidadId: ruta.id,
    entidadNombre: await nombreRuta(input.puerto_origen_id, input.puerto_destino_id),
  });
  return ruta;
}

export async function deleteCosteoRuta(id: string): Promise<void> {
  const { error } = await supabase.from("costeo_rutas").delete().eq("id", id);
  if (error) throw error;
  await registrarActividad({
    modulo: "costeo",
    accion: "eliminar_ruta_costeo",
    entidadId: id,
  });
}
