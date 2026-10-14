/** Etiqueta «Empresa eliminada» para tarjetas del Kanban y la ficha de oportunidad. */
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { crm } from "@/features/crm/queryKeys";
import { fetchOportunidadesEmpresaEliminada } from "@/features/crm/services/empresaEliminadaCrm";

export function EtiquetaEmpresaEliminada({ oportunidadId }: { oportunidadId: string }) {
  // Una sola consulta compartida por todas las tarjetas (misma llave de caché).
  const { data } = useQuery({
    queryKey: crm.objetos.empresaEliminada,
    queryFn: fetchOportunidadesEmpresaEliminada,
    staleTime: 30_000,
  });
  if (!data?.has(oportunidadId)) return null;
  return <Badge variant="destructive" className="text-label h-5 px-1.5 w-fit">Empresa eliminada</Badge>;
}
