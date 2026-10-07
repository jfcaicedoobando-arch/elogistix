/**
 * Origen de una oportunidad deducido de su empresa CRM: el cliente del
 * directorio ligado o, si no hay, el prospecto (lead) de origen calificado.
 * Lo usa el alta rápida para no pedir "Origen/Cliente" a mano sin debilitar
 * el guard `_crm_oportunidad_requiere_origen`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { OrigenInicial } from "@/features/crm/domain/oportunidadFormHelpers";

const LEAD_NO_CALIFICADO = ["Nuevo", "Contactado", "Descalificado"];

export type OrigenEmpresa =
  | { ok: true; origen: OrigenInicial }
  | { ok: false; motivo: string };

const SIN_ORIGEN =
  "Esta empresa aún no es prospecto ni cliente. Pásala a prospecto desde su ficha para crear la oportunidad.";

async function origenCliente(clienteId: string): Promise<OrigenEmpresa> {
  const { data, error } = await supabase.from("clientes")
    .select("id, nombre").eq("id", clienteId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, motivo: SIN_ORIGEN };
  return { ok: true, origen: { tipo: "cliente", id: data.id, nombre: data.nombre ?? "" } };
}

async function origenLead(leadId: string): Promise<OrigenEmpresa> {
  const { data, error } = await supabase.from("crm_leads")
    .select("id, empresa, estado, vendedor_id, vendedor_email")
    .eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data || LEAD_NO_CALIFICADO.includes(String(data.estado))) return { ok: false, motivo: SIN_ORIGEN };
  return {
    ok: true,
    origen: {
      tipo: "prospecto", id: data.id, nombre: data.empresa ?? "",
      vendedorId: data.vendedor_id ?? null, vendedorEmail: data.vendedor_email ?? "",
    },
  };
}

export async function fetchOrigenEmpresa(empresaId: string): Promise<OrigenEmpresa> {
  const { data, error } = await supabase.from("crm_empresas")
    .select("cliente_id, lead_origen_id").eq("id", empresaId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (data?.cliente_id) return origenCliente(data.cliente_id);
  if (data?.lead_origen_id) return origenLead(data.lead_origen_id);
  return { ok: false, motivo: SIN_ORIGEN };
}
