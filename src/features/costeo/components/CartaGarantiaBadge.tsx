/**
 * Badge de estatus de carta garantía respecto a la fecha de hoy.
 */
import { Badge } from "@/components/ui/badge";
import { calcularEstadoCartaGarantia } from "@/features/costeo/types/navieraCondicion";

interface Props {
  tieneCarta: boolean;
  vigenteHasta: string | null;
}

export function CartaGarantiaBadge({ tieneCarta, vigenteHasta }: Props) {
  const estado = calcularEstadoCartaGarantia(tieneCarta, vigenteHasta);
  if (estado === "sin_carta") {
    return <Badge variant="outline">Sin carta</Badge>;
  }
  if (estado === "vigente") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Carta vigente</Badge>;
  }
  if (estado === "por_vencer") {
    return <Badge className="bg-amber-500 hover:bg-amber-500">Por vencer</Badge>;
  }
  return <Badge variant="destructive">Vencida</Badge>;
}
