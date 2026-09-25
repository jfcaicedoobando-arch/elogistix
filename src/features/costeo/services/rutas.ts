/**
 * Servicio: CRUD de rutas de costeo (par puerto origen → puerto destino).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CosteoRuta } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";
import { registrarActividad } from "@/services/bitacora/registrar";
import {
  agregarTarifasRuta,
  type TarifaRutaAgregable,
} from "@/features/costeo/utils/rutaTarifasAgregado";

interface RawPuertoRuta {
  name: string;
  code: string | null;
  country: string | null;
}

interface RawRuta extends CosteoRuta {
  puerto_origen?: RawPuertoRuta | null;
  puerto_destino?: RawPuertoRuta | null;
  costeo_tarifas?: TarifaRutaAgregable[] | null;
}

export async function fetchCosteoRutas(organizationId: string): Promise<CosteoRuta[]> {
  const { data, error } = await supabase
    .from("costeo_rutas")
    .select(
      "*, puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name,code,country), puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name,code,country), costeo_tarifas!costeo_tarifas_ruta_id_fkey(estado,estado_aprobacion,vigente_desde,vigente_hasta,updated_at,agente_id)",
    )
    .eq("organization_id", organizationId);
  if (error) throw error;
  const hoyIso = todayLocalISO();
  return ((data ?? []) as RawRuta[]).map((r) => ({
    ...r,
    puerto_origen_nombre: r.puerto_origen?.name,
    puerto_origen_code: r.puerto_origen?.code ?? null,
    puerto_origen_country: r.puerto_origen?.country ?? null,
    puerto_destino_nombre: r.puerto_destino?.name,
    puerto_destino_code: r.puerto_destino?.code ?? null,
    puerto_destino_country: r.puerto_destino?.country ?? null,
    ...agregarTarifasRuta(r.costeo_tarifas ?? [], hoyIso),
  }));
}


export interface CosteoRutaInput {
  puerto_origen_id: string;
  puerto_destino_id: string;
  activa?: boolean;
}

export class CosteoRutaDuplicadaError extends Error {
  constructor() {
    super("Esta ruta marítima ya está registrada en tu organización.");
    this.name = "CosteoRutaDuplicadaError";
  }
}

export class CosteoRutaMismoPuertoError extends Error {
  constructor() {
    super("El puerto de origen y el de destino deben ser distintos.");
    this.name = "CosteoRutaMismoPuertoError";
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
  // Defensa de dominio: la UI ya lo evita, pero una ruta a sí misma no existe.
  if (input.puerto_origen_id === input.puerto_destino_id) {
    throw new CosteoRutaMismoPuertoError();
  }
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
