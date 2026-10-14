/** Etiqueta «Solicitud respondida» para tarjetas del Kanban y la ficha de oportunidad. */
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { fetchOportunidadesSolicitudRespondida, LLAVE_SOLICITUD_RESPONDIDA } from "@/features/crm/services/solicitudRespondidaCrm";

export function EtiquetaSolicitudRespondida({ oportunidadId }: { oportunidadId: string }) {
  // Una sola consulta compartida por todas las tarjetas (misma llave de caché).
  const { data } = useQuery({
    queryKey: LLAVE_SOLICITUD_RESPONDIDA,
    queryFn: fetchOportunidadesSolicitudRespondida,
    staleTime: 30_000,
  });
  if (!data?.has(oportunidadId)) return null;
  return <Badge variant="success" className="text-label h-5 px-1.5 w-fit">Solicitud respondida</Badge>;
}
