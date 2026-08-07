/**
 * CRUD y consultas de organizaciones para la consola super admin.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface OrgRow {
  id: string;
  nombre: string;
  rfc: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

export async function fetchAdminOrganizations(): Promise<OrgRow[]> {
  const data = await unwrap(
    supabase.from("organizations").select("*").order("nombre"),
  );
  return fromDb<OrgRow[]>(data);
}

export async function fetchOrganizationsList() {
  return unwrapOr(
    supabase.from("organizations").select("id, nombre").order("nombre"),
    [],
  );
}

/**
 * v13.301.51 — Fase 2 multi-tenant: aprovisiona una organización mediante la
 * RPC `provision_organization`, que sólo acepta super_admin y crea el vínculo
 * inicial `organization_members` (rol `admin`) para el owner indicado.
 */
export async function createOrganization(input: {
  nombre: string;
  rfc: string;
  ownerUserId: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("provision_organization", {
    p_nombre: input.nombre,
    p_rfc: input.rfc,
    p_owner_user_id: input.ownerUserId,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "usuarios",
    accion: "Creó organización",
    entidadId: data as string,
    entidadNombre: input.nombre,
    detalles: { rfc: input.rfc },
  });
  return data as string;
}

export async function fetchAdminOrganization(id: string) {
  return unwrap(
    supabase.from("organizations").select("*").eq("id", id).single(),
  );
}

export async function updateAdminOrganization(
  id: string,
  payload: { nombre: string; rfc: string; plan: string },
): Promise<void> {
  await run(supabase.from("organizations").update(payload).eq("id", id));
  await registrarActividad({
    modulo: "usuarios",
    accion: "Editó organización",
    entidadId: id,
    entidadNombre: payload.nombre,
    detalles: { rfc: payload.rfc, plan: payload.plan },
  });
}

export async function establecerOrganizacionActiva(id: string, activo: boolean): Promise<void> {
  await run(supabase.from("organizations").update({ activo }).eq("id", id));
  await registrarActividad({
    modulo: "usuarios",
    accion: activo ? "Activó organización" : "Desactivó organización",
    entidadId: id,
  });
}
