/** Etiqueta «Empresa eliminada» para tarjetas del Kanban y la ficha de oportunidad. */
import { Badge } from "@/components/ui/badge";
import { useOportunidadesEmpresaEliminada } from "@/features/crm/hooks/useEtiquetasOportunidad";

export function EtiquetaEmpresaEliminada({ oportunidadId }: { oportunidadId: string }) {
  const { data } = useOportunidadesEmpresaEliminada();
  if (!data?.has(oportunidadId)) return null;
  return <Badge variant="destructive" className="text-label h-5 px-1.5 w-fit">Empresa eliminada</Badge>;
}
