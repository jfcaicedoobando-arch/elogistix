/**
 * Encabezado de la ficha de lead (extraído de `LeadDetalle.tsx` para mantener
 * la ruta bajo el límite de complejidad del lint). No cambia comportamiento.
 */
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetailHeader } from "@/components/shared/DetailHeader";
import ContactActions from "@/features/crm/components/ContactActions";
import LeadHeaderActions from "@/features/crm/components/leadDetalle/LeadHeaderActions";
import { puedeCalificarse } from "@/features/crm/domain/leads/etapas";
import { formatFechaEs } from "@/lib/formatters/dates";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

interface Props {
  lead: CrmLeadRow;
  volver: string;
  puedeGestionar: boolean;
  canTomarLead: boolean;
  canCrearOportunidad: boolean;
  esProspecto: boolean;
  destinoConversion: string | null;
  onNavegarConversion: (destino: string) => void;
  onEliminar: () => void;
  onTomar: () => void;
  tomando: boolean;
  onCalificar: () => void;
  calificando: boolean;
  onNuevaOportunidad: () => void;
}

export default function LeadDetalleHeader({
  lead, volver, puedeGestionar, canTomarLead, canCrearOportunidad, esProspecto,
  destinoConversion, onNavegarConversion, onEliminar, onTomar, tomando,
  onCalificar, calificando, onNuevaOportunidad,
}: Props) {
  return (
    <DetailHeader
      backTo={volver}
      backLabel="Volver a Leads"
      icon={<UserPlus className="h-6 w-6 text-accent shrink-0" />}
      title={lead.empresa}
      titleAs="h2"
      badge={<Badge variant="outline" className="capitalize">{lead.estado}</Badge>}
      subtitle={`Lead · ${lead.fuente} · creado ${formatFechaEs(lead.created_at)}`}
      meta={
        <ContactActions
          email={lead.email}
          telefono={lead.telefono}
          plantillaCtx={{
            entidadTipo: "lead",
            entidadId: lead.id,
            vars: {
              contacto: lead.contacto || lead.empresa,
              empresa: lead.empresa,
              vendedor: lead.vendedor_email,
              etapa: lead.estado,
            },
          }}
        />
      }
      trailing={
        <LeadHeaderActions
          estado={lead.estado}
          canEdit={puedeGestionar}
          onEliminar={onEliminar}
          onVerConversion={destinoConversion ? () => onNavegarConversion(destinoConversion) : undefined}
          mostrarTomar={canTomarLead && !lead.vendedor_id && lead.estado !== "Convertido"}
          onTomar={onTomar}
          tomando={tomando}
          mostrarCalificar={!!lead.vendedor_id && puedeGestionar && puedeCalificarse(lead.estado)}
          onCalificar={onCalificar}
          calificando={calificando}
          mostrarNuevaOportunidad={puedeGestionar && canCrearOportunidad && esProspecto}
          onNuevaOportunidad={onNuevaOportunidad}
        />
      }
    />
  );
}
