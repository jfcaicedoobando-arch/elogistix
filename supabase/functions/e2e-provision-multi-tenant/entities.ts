// Upserts de entidades trazadoras para `e2e-provision-multi-tenant`.
// Extraído de provisioning.ts para respetar el límite de longitud del lint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type AdminClient = ReturnType<typeof createClient>;

export const BUCKET = "documentos";

export async function upsertCliente(
  admin: AdminClient,
  orgId: string,
  marker: string,
): Promise<string> {
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

export async function upsertEmbarque(
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

export async function upsertFactura(
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

export async function upsertCotizacion(
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

export async function uploadMarker(
  admin: AdminClient,
  path: string,
  marker: string,
): Promise<void> {
  const body = new TextEncoder().encode(`${marker}\n${new Date().toISOString()}\n`);
  const { error } = await admin.storage.from(BUCKET).upload(path, body, {
    contentType: "text/plain",
    upsert: true,
  });
  if (error) throw error;
}
