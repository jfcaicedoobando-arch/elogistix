/** Etiqueta «Empresa eliminada» para tarjetas del Kanban y la ficha de oportunidad. */
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { fetchOportunidadesEmpresaEliminada } from "@/features/crm/services/empresaEliminadaCrm";

/** Una sola consulta compartida por todas las tarjetas (misma llave de caché). */
export function useEmpresaEliminada(oportunidadId: string): boolean {
  const { data } = useQuery({
    queryKey: ["crm", "objetos", "empresa-eliminada"],
    queryFn: fetchOportunidadesEmpresaEliminada,
    staleTime: 30_000,
  });
  return data?.has(oportunidadId) ?? false;
}

export function EtiquetaEmpresaEliminada({ oportunidadId }: { oportunidadId: string }) {
  if (!useEmpresaEliminada(oportunidadId)) return null;
  return <Badge variant="destructive" className="text-label h-5 px-1.5">Empresa eliminada</Badge>;
}
