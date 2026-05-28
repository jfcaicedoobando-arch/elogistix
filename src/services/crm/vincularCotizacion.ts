/**
 * Vinculación CRM ↔ Cotización (prospectos).
 * Garantiza que toda cotización a prospecto quede anclada a un lead + oportunidad
 * en el pipeline. Soporta tres modos: vincular oportunidad existente,
 * vincular lead existente (creando oportunidad), o crear ambos.
 */
import { supabase } from "@/integrations/supabase/client";
import { createLead } from "@/services/crm/leads/mutations";
import { crearOportunidad } from "@/services/crm/oportunidades";
import { fetchEtapasPipelineActivas } from "@/services/crm/etapas";

interface AuthLite { id?: string; email?: string }

export interface ProspectoData {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
}

export interface VincularInput {
  cotizacionId: string;
  cotizacionFolio?: string;
  modoTransporte: string;
  oportunidadId?: string | null;
  leadId?: string | null;
  prospecto: ProspectoData;
  user: AuthLite | null;
}

function buildOpNombre(empresa: string, folio?: string): string {
  return folio ? `${empresa} — ${folio}` : `Cotización · ${empresa}`;
}

/**
 * Busca la etapa "Cotizando" (abierta, segunda en orden por convención) o
 * la primera abierta como fallback.
 */
async function resolveEtapaCotizandoId(): Promise<{ id: string; probabilidad: number } | null> {
  const etapas = await fetchEtapasPipelineActivas();
  const abiertas = etapas.filter((e) => e.tipo === "abierta");
  if (abiertas.length === 0) return null;
  const cotizando =
    abiertas.find((e) => e.nombre.toLowerCase().includes("cotiz")) ?? abiertas[0];
  return { id: cotizando.id, probabilidad: cotizando.probabilidad_default ?? 30 };
}

async function setCotizacionOportunidad(cotizacionId: string, oportunidadId: string) {
  const { error } = await supabase
    .from("cotizaciones")
    .update({ oportunidad_id: oportunidadId })
    .eq("id", cotizacionId);
  if (error) throw error;
}

/**
 * Idempotente: si la cotización ya tiene `oportunidad_id` no recrea nada.
 * Devuelve los IDs resultantes para que el caller pueda mostrar feedback.
 */
export async function vincularOCrearOportunidadParaCotizacion(
  input: VincularInput,
): Promise<{ oportunidadId: string | null; leadId: string | null }> {
  // Caso A — ya viene una oportunidad: solo enlazar.
  if (input.oportunidadId) {
    await setCotizacionOportunidad(input.cotizacionId, input.oportunidadId);
    return { oportunidadId: input.oportunidadId, leadId: input.leadId ?? null };
  }

  const etapa = await resolveEtapaCotizandoId();
  if (!etapa) return { oportunidadId: null, leadId: input.leadId ?? null };

  // Caso B — lead existente sin oportunidad: crear oportunidad atada al lead.
  if (input.leadId) {
    const op = await crearOportunidad(
      {
        nombre: `${input.prospecto.empresa} — ${input.cotizacionFolio}`,
        lead_id: input.leadId,
        etapa_id: etapa.id,
        probabilidad: etapa.probabilidad,
        modo: input.modoTransporte,
      },
      input.user,
    );
    await setCotizacionOportunidad(input.cotizacionId, op.id);
    return { oportunidadId: op.id, leadId: input.leadId };
  }

  // Caso C — nada vinculado: crear lead + oportunidad.
  const lead = await createLead(
    {
      empresa: input.prospecto.empresa,
      contacto: input.prospecto.contacto,
      email: input.prospecto.email,
      telefono: input.prospecto.telefono,
      interes_modo: input.modoTransporte,
    },
    input.user,
  );
  const op = await crearOportunidad(
    {
      nombre: `${input.prospecto.empresa} — ${input.cotizacionFolio}`,
      lead_id: lead.id,
      etapa_id: etapa.id,
      probabilidad: etapa.probabilidad,
      modo: input.modoTransporte,
    },
    input.user,
  );
  await setCotizacionOportunidad(input.cotizacionId, op.id);
  return { oportunidadId: op.id, leadId: lead.id };
}

/**
 * Mapea el estado de una cotización a la etapa CRM correspondiente y la aplica
 * si la cotización tiene oportunidad vinculada. No-op cuando no hay match.
 */
export async function sincronizarEtapaPorEstadoCotizacion(input: {
  oportunidadId: string;
  estadoCotizacion: string;
}): Promise<void> {
  const etapas = await fetchEtapasPipelineActivas();
  const findByTipo = (tipo: string, nombreHint?: string) => {
    const candidatas = etapas.filter((e) => e.tipo === tipo);
    if (nombreHint) {
      const m = candidatas.find((e) =>
        e.nombre.toLowerCase().includes(nombreHint.toLowerCase()),
      );
      if (m) return m;
    }
    return candidatas[0] ?? null;
  };

  let etapa: { id: string; probabilidad_default: number | null } | null = null;
  let fechaCierreReal: string | null = null;

  switch (input.estadoCotizacion) {
    case "Enviada":
      etapa = findByTipo("abierta", "negoc") ?? findByTipo("abierta", "cotiz");
      break;
    case "Aceptada":
    case "En operación":
      etapa = findByTipo("ganada");
      fechaCierreReal = new Date().toISOString().split("T")[0];
      break;
    case "Rechazada":
      etapa = findByTipo("perdida");
      fechaCierreReal = new Date().toISOString().split("T")[0];
      break;
    default:
      return;
  }

  if (!etapa) return;
  const patch: Record<string, unknown> = {
    etapa_id: etapa.id,
    probabilidad: etapa.probabilidad_default ?? 0,
  };
  if (fechaCierreReal) patch.fecha_cierre_real = fechaCierreReal;
  const { error } = await supabase
    .from("crm_oportunidades")
    .update(patch)
    .eq("id", input.oportunidadId);
  if (error) throw error;
}

/**
 * Llamado tras `convertirProspectoACliente`. Propaga el cliente al CRM:
 * - Setea cliente_id/cliente_nombre en la oportunidad.
 * - Marca el lead asociado como Convertido.
 */
export async function propagarConversionProspectoCRM(input: {
  oportunidadId: string | null;
  clienteId: string;
  clienteNombre: string;
}): Promise<void> {
  if (!input.oportunidadId) return;

  const { data: op, error: errOp } = await supabase
    .from("crm_oportunidades")
    .select("lead_id")
    .eq("id", input.oportunidadId)
    .maybeSingle();
  if (errOp) throw errOp;

  const { error: errUpdOp } = await supabase
    .from("crm_oportunidades")
    .update({ cliente_id: input.clienteId, cliente_nombre: input.clienteNombre })
    .eq("id", input.oportunidadId);
  if (errUpdOp) throw errUpdOp;

  if (op?.lead_id) {
    const { error: errLead } = await supabase
      .from("crm_leads")
      .update({
        estado: "Convertido",
        cliente_convertido_id: input.clienteId,
        oportunidad_convertida_id: input.oportunidadId,
      })
      .eq("id", op.lead_id);
    if (errLead) throw errLead;
  }
}
