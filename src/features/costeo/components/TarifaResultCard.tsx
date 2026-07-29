/**
 * Card de resultado individual del Top 3 de tarifas vigentes.
 * v13.69.1: sub-componentes presentacionales extraídos a TarifaResultCardParts.tsx
 * para cumplir Power of 10 (≤200 líneas) tras el refactor de complejidad.
 */
import { Card } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRecargosDeTarifa } from "@/features/costeo/hooks/useRecargosDeTarifa";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { RankingMeta } from "@/features/costeo/utils/rankingLabels";
import { cn } from "@/lib/utils";
import { TarifaCardDesglose } from "./TarifaCardDesglose";
import { TarifaCardBadges } from "./TarifaCardBadges";
import {
  CardHeader,
  CostoTotalBlock,
  ElegirButton,
  EtiquetasList,
  FechaVigencia,
  PreciosBase,
  WinnerBadge,
} from "./TarifaResultCardParts";

interface Props {
  row: TopTarifaRow;
  rank: number;
  onElegir?: (row: TopTarifaRow) => void;
  selectLabel?: string;
  meta?: RankingMeta;
}

export function TarifaResultCard({ row, rank, onElegir, selectLabel = "Elegir", meta }: Props) {
  const { data: recargos = [] } = useRecargosDeTarifa(row.id);

  const esGanador = meta?.esGanador ?? rank === 1;
  const etiquetas = meta?.etiquetasMejorEn ?? (rank === 1 ? ["Mejor precio"] : []);
  const delta = meta?.deltaTotalVsGanador ?? 0;
  const vencePronto = meta?.vencePronto ?? false;

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        className={cn(
          "p-4 space-y-3 flex flex-col relative transition-shadow",
          esGanador
            ? "border-success bg-success/5 shadow-raised ring-1 ring-success/20"
            : "hover:shadow-raised",
        )}
      >
        {esGanador && <WinnerBadge />}
        <CardHeader row={row} rank={rank} esGanador={esGanador} />
        <EtiquetasList etiquetas={etiquetas} />
        <PreciosBase row={row} />
        <CostoTotalBlock row={row} esGanador={esGanador} delta={delta} />
        <TarifaCardDesglose recargos={recargos} />
        <TarifaCardBadges row={row} />
        <FechaVigencia vigenteHasta={row.vigente_hasta} vencePronto={vencePronto} />
        {onElegir && (
          <ElegirButton row={row} esGanador={esGanador} selectLabel={selectLabel} onElegir={onElegir} />
        )}
      </Card>
    </TooltipProvider>
  );
}
