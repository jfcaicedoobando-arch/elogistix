// Helpers de provisioning para `e2e-provision-multi-tenant`.
// Separado del handler para respetar los límites de longitud/complejidad del lint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  BUCKET,
  upsertCliente,
  upsertEmbarque,
  upsertFactura,
  upsertCotizacion,
  uploadMarker,
} from "./entities.ts";

type AdminClient = ReturnType<typeof createClient>;

export interface OrgSpec {
  nombre: string;
  admin_email: string;
  admin_password: string;
}
export interface MultiTenantPayload {
  org_a?: OrgSpec;
  org_b?: OrgSpec;
}
export interface OrgProvisionResult {
  organization_id: string;
  admin_user_id: string;
  admin_email: string;
  cliente_id: string;
  embarque_id: string;
  factura_id: string;
  cotizacion_id: string;
  storage_bucket: "documentos";
  storage_path: string;
  marker: string;
}

export function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Entry points
// ────────────────────────────────────────────────────────────────────────────

export async function provisionMultiTenant(
  admin: AdminClient,
  payload: MultiTenantPayload,
): Promise<{ org_a: OrgProvisionResult; org_b: OrgProvisionResult }> {
  if (!payload.org_a || !payload.org_b) {
    throw new Error("payload requires org_a and org_b");
  }
  const org_a = await provisionOne(admin, payload.org_a, "A");
  const org_b = await provisionOne(admin, payload.org_b, "B");
  return { org_a, org_b };
}

export async function cleanupOrgsByName(
  admin: AdminClient,
  names: Array<string | undefined>,
): Promise<Array<{ nombre: string; deleted: boolean }>> {
  const results: Array<{ nombre: string; deleted: boolean }> = [];
  for (const nombre of names) {
    if (!nombre) continue;
    const org = await findOrgByName(admin, nombre);
    if (!org) {
      results.push({ nombre, deleted: false });
      continue;
    }
    // Borrar objetos del storage bajo el prefijo de la org.
    const prefix = `e2e-mt/${org.id}/`;
    const { data: objs } = await admin.storage.from(BUCKET).list(`e2e-mt/${org.id}`);
    if (objs && objs.length > 0) {
      await admin.storage.from(BUCKET).remove(objs.map((o) => `${prefix}${o.name}`));
    }
    // Cascada de dominio (embarques, facturas, etc. dependen de organization_id
    // con ON DELETE CASCADE en la mayoría; para las que no, borrar explícito).
    await admin.from("embarques").delete().eq("organization_id", org.id);
    await admin.from("facturas").delete().eq("organization_id", org.id);
    await admin.from("cotizaciones").delete().eq("organization_id", org.id);
    await admin.from("clientes").delete().eq("organization_id", org.id);
    await admin.from("organization_members").delete().eq("organization_id", org.id);
    await admin.from("organizations").delete().eq("id", org.id);
    results.push({ nombre, deleted: true });
  }
  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Provisión de UNA org
// ────────────────────────────────────────────────────────────────────────────

async function provisionOne(
  admin: AdminClient,
  spec: OrgSpec,
  slot: "A" | "B",
): Promise<OrgProvisionResult> {
  const org = (await findOrgByName(admin, spec.nombre)) ?? (await createOrg(admin, spec.nombre));
  const marker = `E2E-MT-${slot}-${org.id.slice(0, 8)}`;
  const admin_user_id = await upsertUser(admin, spec.admin_email, spec.admin_password);
  await upsertRoleAndMember(admin, admin_user_id, org.id);
  const cliente_id = await upsertCliente(admin, org.id, marker);
  const embarque_id = await upsertEmbarque(admin, org.id, cliente_id, slot, marker);
  const factura_id = await upsertFactura(admin, org.id, cliente_id, marker);
  const cotizacion_id = await upsertCotizacion(admin, org.id, cliente_id, marker);
  const storage_path = `e2e-mt/${org.id}/${embarque_id}/marker.txt`;
  await uploadMarker(admin, storage_path, marker);
  return {
    organization_id: org.id,
    admin_user_id,
    admin_email: spec.admin_email,
    cliente_id,
    embarque_id,
    factura_id,
    cotizacion_id,
    storage_bucket: BUCKET,
    storage_path,
    marker,
  };
}

async function findOrgByName(admin: AdminClient, nombre: string) {
  const { data, error } = await admin
    .from("organizations")
    .select("id, nombre")
    .eq("nombre", nombre)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; nombre: string } | null;
}

async function createOrg(admin: AdminClient, nombre: string): Promise<{ id: string }> {
  const rfc = `E2E${Date.now().toString().slice(-6)}XXX`;
  const { data, error } = await admin
    .from("organizations")
    .insert({ nombre, rfc, plan: "starter", activo: true })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

async function upsertUser(admin: AdminClient, email: string, password: string): Promise<string> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) {
      const { error: upErr } = await admin.auth.admin.updateUserById(hit.id, {
        password,
        email_confirm: true,
      });
      if (upErr) throw upErr;
      return hit.id;
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user!.id;
}

async function upsertRoleAndMember(admin: AdminClient, userId: string, orgId: string) {
  const roleRes = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });
  if (roleRes.error) throw roleRes.error;
  const memberRes = await admin
    .from("organization_members")
    .upsert(
      { user_id: userId, organization_id: orgId, role: "admin" },
      { onConflict: "user_id" },
    );
  if (memberRes.error) throw memberRes.error;
}

async function upsertCliente(admin: AdminClient, orgId: string, marker: string): Promise<string> {
  const existing = await admin
    .from("clientes")
    .select("id")
    .eq("organization_id", orgId)
    .eq("nombre", `Cliente ${marker}`)
    .maybeSingle();
  if (existing.data) return existing.data.id as string;
  const { data, error } = await admin
    .from("clientes")
    .insert({ organization_id: orgId, nombre: `Cliente ${marker}` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertEmbarque(
  admin: AdminClient,
  orgId: string,
  clienteId: string,
  slot: "A" | "B",
  marker: string,
): Promise<string> {
  // Formato válido para el CHECK `embarques_expediente_formato_valido`:
  // `^EL[A-Z]{3}[0-9]+$`. Usamos EL + "MT"+slot + timestamp.
  const expediente = `ELMT${slot}${Date.now().toString().slice(-8)}`;
  const existing = await admin
    .from("embarques")
    .select("id")
    .eq("organization_id", orgId)
    .eq("cliente_id", clienteId)
    .like("notas", `${marker}%`)
    .maybeSingle();
  if (existing.data) return existing.data.id as string;
  const { data, error } = await admin
    .from("embarques")
    .insert({
      organization_id: orgId,
      cliente_id: clienteId,
      expediente,
      modo: "Marítimo",
      tipo: "Importación",
      notas: `${marker} · trazador multi-tenant`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertFactura(
  admin: AdminClient,
  orgId: string,
  clienteId: string,
  marker: string,
): Promise<string> {
  const numero = `E2E-${marker}`;
  const existing = await admin
    .from("facturas")
    .select("id")
    .eq("organization_id", orgId)
    .eq("numero", numero)
    .maybeSingle();
  if (existing.data) return existing.data.id as string;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("facturas")
    .insert({
      organization_id: orgId,
      cliente_id: clienteId,
      numero,
      fecha_emision: today,
      fecha_vencimiento: today,
      subtotal: 0,
      iva: 0,
      total: 0,
      estado: "Borrador",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertCotizacion(
  admin: AdminClient,
  orgId: string,
  clienteId: string,
  marker: string,
): Promise<string> {
  const folio = `E2E-COT-${marker}`;
  const existing = await admin
    .from("cotizaciones")
    .select("id")
    .eq("organization_id", orgId)
    .eq("folio", folio)
    .maybeSingle();
  if (existing.data) return existing.data.id as string;
  const { data, error } = await admin
    .from("cotizaciones")
    .insert({
      organization_id: orgId,
      cliente_id: clienteId,
      folio,
      modo: "Marítimo",
      tipo: "Importación",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function uploadMarker(admin: AdminClient, path: string, marker: string): Promise<void> {
  const body = new TextEncoder().encode(`${marker}\n${new Date().toISOString()}\n`);
  const { error } = await admin.storage.from(BUCKET).upload(path, body, {
    contentType: "text/plain",
    upsert: true,
  });
  if (error) throw error;
}
