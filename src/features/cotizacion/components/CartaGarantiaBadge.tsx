/**
 * Indicador del estado real de la carta garantía de la naviera de una tarifa.
 * Sustituye al toggle manual cuando hay tarifa vinculada en la cotización.
 */
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from "lucide-react";
import { calcularEstadoCartaGarantia } from "@/features/costeo/types/navieraCondicion";
import type { TopTarifaRow } from "@/features/costeo/types";

interface Props {
  tarifa: TopTarifaRow;
}

export default function CartaGarantiaBadge({ tarifa }: Props) {
  const estado = calcularEstadoCartaGarantia(
    tarifa.naviera_tiene_carta_garantia,
    tarifa.naviera_carta_garantia_vigente_hasta,
  );

  if (estado === "sin_carta") {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <ShieldQuestion className="h-3.5 w-3.5" />
        Sin carta garantía — se cobrará depósito
      </Badge>
    );
  }
  if (estado === "vencida") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-destructive/10 text-destructive border-destructive/30">
        <ShieldX className="h-3.5 w-3.5" />
        Vencida {tarifa.naviera_carta_garantia_vigente_hasta && `el ${tarifa.naviera_carta_garantia_vigente_hasta}`} — se cobrará depósito
      </Badge>
    );
  }
  if (estado === "por_vencer") {
    return (
      <Badge variant="outline" className="gap-1.5 bg-warning/10 text-warning border-warning/30">
        <ShieldAlert className="h-3.5 w-3.5" />
        Por vencer el {tarifa.naviera_carta_garantia_vigente_hasta} ({tarifa.naviera_nombre})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 bg-success/10 text-success border-success/30">
      <ShieldCheck className="h-3.5 w-3.5" />
      Vigente hasta {tarifa.naviera_carta_garantia_vigente_hasta} ({tarifa.naviera_nombre})
    </Badge>
  );
}
