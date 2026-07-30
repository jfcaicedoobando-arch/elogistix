/**
 * Vincula una cotización a una oportunidad/lead existente o crea ambos.
 */
import { createLead } from "@/features/crm/services/leads/mutations";
import { crearOportunidad } from "@/features/crm/services/oportunidades";
import {
  buildOpNombre, resolveEtapaCotizandoId, setCotizacionOportunidad,
  findLeadIdByEmail,
  type AuthLite, type ProspectoData,
} from "./helpers";

export interface VincularInput {
  cotizacionId: string;
  cotizacionFolio?: string;
  modoTransporte: string;
  oportunidadId?: string | null;
  leadId?: string | null;
  prospecto: ProspectoData;
  user: AuthLite | null;
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
        nombre: buildOpNombre(input.prospecto.empresa, input.cotizacionFolio),
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

  // Caso C — nada vinculado: reutilizar lead con el mismo email o crearlo.
  const existenteId = await findLeadIdByEmail(input.prospecto.email);
  const leadId =
    existenteId ??
    (
      await createLead(
        {
          empresa: input.prospecto.empresa,
          contacto: input.prospecto.contacto,
          email: input.prospecto.email,
          telefono: input.prospecto.telefono,
          interes_modo: input.modoTransporte,
        },
        input.user,
      )
    ).id;
  const op = await crearOportunidad(
    {
      nombre: buildOpNombre(input.prospecto.empresa, input.cotizacionFolio),
      cliente_nombre: input.prospecto.empresa,
      lead_id: leadId,
      etapa_id: etapa.id,
      probabilidad: etapa.probabilidad,
      modo: input.modoTransporte,
    },
    input.user,
  );
  await setCotizacionOportunidad(input.cotizacionId, op.id);
  return { oportunidadId: op.id, leadId };
}
