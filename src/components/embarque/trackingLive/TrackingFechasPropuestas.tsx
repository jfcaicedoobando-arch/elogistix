import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import type { useTrackingLiveCard } from "@/hooks/embarque";

interface Props {
  ctrl: ReturnType<typeof useTrackingLiveCard>;
  etd?: string | null;
  eta?: string | null;
  fechaLlegadaReal?: string | null;
}

export function TrackingFechasPropuestas({ ctrl, etd, eta, fechaLlegadaReal }: Props) {
  const { fechasPropuestas, summary, applyFechas, onAplicarFechas, setFechasDismissed } = ctrl;
  if (!fechasPropuestas || !summary) return null;

  return (
    <div className="flex items-start gap-2 text-xs p-3 rounded bg-accent/5 border border-accent/30">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
      <div className="space-y-2 flex-1">
        <p className="font-medium">JSONCargo reporta fechas distintas a las del embarque.</p>
        <ul className="space-y-0.5">
          {fechasPropuestas.etdDifiere && (
            <li>
              <span className="text-muted-foreground">ETD origen:</span>{" "}
              <span className="font-mono">{etd ? formatDate(etd, "dd MMM yyyy") : "—"}</span>
              {" → "}
              <span className="font-mono font-semibold">{formatDate(fechasPropuestas.etdPropuesta!, "dd MMM yyyy")}</span>
            </li>
          )}
          {fechasPropuestas.etaDifiere && (
            <li>
              <span className="text-muted-foreground">ETA destino:</span>{" "}
              <span className="font-mono">{eta ? formatDate(eta, "dd MMM yyyy") : "—"}</span>
              {" → "}
              <span className="font-mono font-semibold">{formatDate(fechasPropuestas.etaPropuesta!, "dd MMM yyyy")}</span>
            </li>
          )}
          {fechasPropuestas.ataDifiere && (
            <li>
              <span className="text-muted-foreground">ATA (arribo real):</span>{" "}
              <span className="font-mono">{fechaLlegadaReal ? formatDate(fechaLlegadaReal, "dd MMM yyyy") : "—"}</span>
              {" → "}
              <span className="font-mono font-semibold">{formatDate(fechasPropuestas.ataPropuesta!, "dd MMM yyyy")}</span>
              {summary.ata_is_inferred && (
                <Badge variant="outline" className="ml-2 text-[10px]">Inferida del último movimiento</Badge>
              )}
              {!fechasPropuestas.etaDifiere && (
                <span className="ml-2 text-[10px] text-muted-foreground">(también se aplicará como ETA)</span>
              )}
            </li>
          )}
        </ul>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onAplicarFechas} disabled={applyFechas.isPending}>
            {applyFechas.isPending ? "Aplicando..." : "Actualizar embarque"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFechasDismissed(true)}>
            Ignorar
          </Button>
        </div>
      </div>
    </div>
  );
}
