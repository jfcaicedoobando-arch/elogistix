/** Etiqueta «Solicitud respondida» para tarjetas del Kanban y la ficha de oportunidad. */
import { Badge } from "@/components/ui/badge";
import { useOportunidadesSolicitudRespondida } from "@/features/crm/hooks/useEtiquetasOportunidad";

export function EtiquetaSolicitudRespondida({ oportunidadId }: { oportunidadId: string }) {
  const { data } = useOportunidadesSolicitudRespondida();
  if (!data?.has(oportunidadId)) return null;
  return <Badge variant="success" className="text-label h-5 px-1.5 w-fit">Solicitud respondida</Badge>;
}
