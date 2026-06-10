/**
 * Card de resultado individual del Top 3 de tarifas vigentes.
 * Muestra desglose, badge de carta garantía y costo de demoras.
 */
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, ShieldCheck, ShieldAlert, ShieldOff, Clock, CreditCard, Ship } from "lucide-react";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";

const usd = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(Number(n || 0));

function CartaGarantiaIndicator({ row }: { row: TopTarifaRow }) {
  if (!row.naviera_condicion_id) {
    return (
      <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
        Sin condiciones naviera
      </Badge>
    );
  }
  if (row.naviera_carta_garantia_activa) {
    return (
      <Badge variant="outline" className="bg-success/15 text-success border-success/30">
        <ShieldCheck className="size-3 mr-1" /> Carta garantía vigente
      </Badge>
    );
  }
  if (row.naviera_tiene_carta_garantia) {
    return (
      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
        <ShieldAlert className="size-3 mr-1" /> Carta garantía vencida
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      <ShieldOff className="size-3 mr-1" /> Sin carta garantía
    </Badge>
  );
}

interface Props {
  row: TopTarifaRow;
  rank: number;
  onElegir?: (row: TopTarifaRow) => void;
  selectLabel?: string;
}

export function TarifaResultCard({ row, rank, onElegir, selectLabel = "Elegir" }: Props) {
  const { data: recargos = [] } = useQuery({
    queryKey: ["costeo", "tarifa-recargos", row.id],
    queryFn: () => fetchRecargosDeTarifa(row.id),
    staleTime: 60 * 1000,
  });

  const rankStyles =
    rank === 1
      ? "border-success/40 bg-success/5"
      : rank === 2
      ? "border-accent/40 bg-accent/5"
      : "border-border";

  return (
    <Card className={`p-4 space-y-3 ${rankStyles}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
            {rank === 1 ? <Trophy className="size-4" /> : `#${rank}`}
          </div>
          <div>
            <p className="font-semibold text-foreground">{row.agente_nombre}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Ship className="size-3" /> {row.naviera_nombre} · {row.tipo_contenedor_nombre}
            </p>
          </div>
        </div>
        <CartaGarantiaIndicator row={row} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Flete base</span><span>{usd(row.flete_base)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Recargos</span><span>{usd(row.recargos_total)}</span></div>
        <div className="col-span-2 flex justify-between border-t pt-2">
          <span className="font-medium">Total comparable</span>
          <span className="text-lg font-bold text-foreground">{usd(row.total_comparable)}</span>
        </div>
      </div>

      {recargos.length > 0 && (
        <div className="text-xs space-y-1">
          {recargos.map((r) => (
            <div key={r.id} className="flex justify-between text-muted-foreground">
              <span>{r.concepto} ({r.lado})</span>
              <span>{usd(Number(r.monto))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="gap-1">
          <CreditCard className="size-3" /> {row.dias_credito} días crédito
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Clock className="size-3" /> {row.dias_libres_demoras} días libres
        </Badge>
        {row.transit_time_dias != null && (
          <Badge variant="outline">{row.transit_time_dias} días tránsito</Badge>
        )}
        {row.naviera_demora_dia_6 != null && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            Demora día 6: {usd(row.naviera_demora_dia_6)}/día
          </Badge>
        )}
      </div>

      <div className="text-xs text-muted-foreground">Vigente hasta: {row.vigente_hasta}</div>

      {onElegir && (
        <Button className="w-full" onClick={() => onElegir(row)}>
          {selectLabel}
        </Button>
      )}
    </Card>
  );
}
