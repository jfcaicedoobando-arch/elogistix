/**
 * Indicador de estado de la carta de garantía de la naviera.
 * Extraído de TarifaResultCard para cumplir Power of 10 (≤200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import type { TopTarifaRow } from "@/features/costeo/types";

export function CartaGarantiaIndicator({ row }: { row: TopTarifaRow }) {
  if (!row.naviera_condicion_id) {
    return (
      <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 gap-1">
        <ShieldOff className="size-3" /> Sin condiciones
      </Badge>
    );
  }
  if (row.naviera_carta_garantia_activa) {
    return (
      <Badge variant="outline" className="bg-success/15 text-success border-success/30 gap-1">
        <ShieldCheck className="size-3" /> Carta vigente
      </Badge>
    );
  }
  if (row.naviera_tiene_carta_garantia) {
    return (
      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
        <ShieldAlert className="size-3" /> Carta vencida
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
      <ShieldOff className="size-3" /> Sin carta
    </Badge>
  );
}
