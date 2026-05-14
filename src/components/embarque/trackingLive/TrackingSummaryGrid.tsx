import { Anchor, CheckCircle2, MapPin, RefreshCw, Ship } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/formatters";
import type { useTrackingLiveCard } from "@/hooks/embarque/useTrackingLiveCard";

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="font-medium text-sm">{children}</p>
    </div>
  );
}

export function TrackingSummaryGrid({ ctrl }: { ctrl: ReturnType<typeof useTrackingLiveCard> }) {
  const { summary, tracking } = ctrl;
  if (!summary || tracking?.status !== "ok") return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <Field icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Estado">
        {summary.container_status ?? "—"}
      </Field>
      <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Última ubicación">
        {summary.last_location ?? "—"}
      </Field>
      <Field icon={<Ship className="h-3.5 w-3.5" />} label="Vessel actual">
        {summary.current_vessel
          ? `${summary.current_vessel}${summary.current_voyage ? ` · ${summary.current_voyage}` : ""}`
          : "—"}
      </Field>
      <Field icon={<Anchor className="h-3.5 w-3.5" />} label="ETD origen (JSONCargo)">
        {(() => {
          const etdShown = summary.etd_origin_effective ?? summary.atd_origin;
          if (!etdShown) return "—";
          const label = formatDate(etdShown, "dd MMM yyyy");
          return summary.etd_origin_is_estimated ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    {label} <span className="text-xs text-muted-foreground">(estimado)</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  JSONCargo no reporta zarpe explícito; estimado desde el último movimiento "Loaded on vessel".
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : label;
        })()}
      </Field>
      <Field icon={<Anchor className="h-3.5 w-3.5" />} label="ETA destino final (JSONCargo)">
        {summary.eta_final_destination ? formatDate(summary.eta_final_destination, "dd MMM yyyy") : "—"}
      </Field>
      <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Origen → Destino">
        {summary.shipped_from ?? "—"} → {summary.shipped_to ?? "—"}
      </Field>
      <Field icon={<RefreshCw className="h-3.5 w-3.5" />} label="Última actualización">
        {tracking.last_synced_at ? formatDate(tracking.last_synced_at, "dd MMM yyyy HH:mm") : "—"}
      </Field>
    </div>
  );
}
