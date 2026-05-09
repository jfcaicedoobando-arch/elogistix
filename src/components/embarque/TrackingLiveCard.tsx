import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Ship, MapPin, Anchor, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError, notifyInfo } from "@/lib/ui/appFeedback";
import { formatDate } from "@/lib/formatters";
import { mapNavieraToJsonCargo, listNavierasSoportadas } from "@/lib/jsoncargo/navieras";
import {
  useJsonCargoTracking,
  useSyncJsonCargo,
  extractSummary,
} from "@/hooks/embarque/useJsonCargoTracking";

interface Props {
  embarqueId: string;
  modo: string | null;
  naviera: string | null;
  contenedor: string | null;
  /** Si true, no muestra botón de sincronizar (portal cliente). */
  readOnly?: boolean;
}

export function TrackingLiveCard({ embarqueId, modo, naviera, contenedor, readOnly }: Props) {
  const { toast } = useToast();
  const { data: tracking, isLoading } = useJsonCargoTracking(embarqueId);
  const sync = useSyncJsonCargo();

  // Solo aplica a marítimo
  if (modo !== "Marítimo") return null;

  const sl = mapNavieraToJsonCargo(naviera);
  const noSoportada = !sl;
  const sinContenedor = !contenedor;
  const summary = tracking?.raw_payload ? extractSummary(tracking.raw_payload) : null;

  const handleSync = async () => {
    try {
      const res = await sync.mutateAsync(embarqueId);
      if (res.throttled) {
        notifyInfo(toast, { title: "Sincronización reciente", description: res.message ?? "Espera unos minutos." });
      } else if (res.ok) {
        notifySuccess(toast, {
          title: "Tracking actualizado",
          description: res.eventos_creados ? `${res.eventos_creados} evento(s) nuevo(s).` : "Sin cambios desde la última sincronización.",
        });
      } else {
        notifyError(toast, { title: "No se pudo sincronizar", description: res.error ?? "Error desconocido" });
      }
    } catch (err) {
      notifyError(toast, { title: "Error de tracking", description: err instanceof Error ? err.message : "Error" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ship className="h-4 w-4 text-accent" />
          Tracking en vivo (JSONCargo)
          {tracking?.status === "ok" && <Badge variant="secondary" className="text-[10px]">Conectado</Badge>}
          {tracking?.status === "failed" && <Badge variant="destructive" className="text-[10px]">Error</Badge>}
        </CardTitle>
        {!readOnly && !noSoportada && !sinContenedor && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={sync.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
            {tracking ? "Actualizar" : "Sincronizar"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {sinContenedor && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded bg-muted/30">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Captura el número de contenedor en el embarque para activar el tracking automático.</p>
          </div>
        )}

        {!sinContenedor && noSoportada && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded bg-muted/30">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Naviera "{naviera ?? "—"}" no soportada por JSONCargo.</p>
              <p className="mt-1">
                Soportadas: {listNavierasSoportadas().map((n) => n.label).join(", ")}.
              </p>
            </div>
          </div>
        )}

        {!sinContenedor && !noSoportada && !tracking && !isLoading && (
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? "Aún no hay datos de tracking en vivo."
              : "Sin sincronización previa. Pulsa Sincronizar para consultar JSONCargo."}
          </p>
        )}

        {tracking?.status === "failed" && (
          <div className="flex items-start gap-2 text-xs text-destructive p-3 rounded bg-destructive/5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Error al consultar JSONCargo</p>
              <p className="mt-0.5">{tracking.failed_reason ?? "—"}</p>
            </div>
          </div>
        )}

        {summary && tracking?.status === "ok" && (
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
            <Field icon={<Anchor className="h-3.5 w-3.5" />} label="ETA destino final">
              {summary.eta_final_destination ? formatDate(summary.eta_final_destination, "dd MMM yyyy") : "—"}
            </Field>
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Origen → Destino">
              {summary.shipped_from ?? "—"} → {summary.shipped_to ?? "—"}
            </Field>
            <Field icon={<RefreshCw className="h-3.5 w-3.5" />} label="Última actualización">
              {tracking.last_synced_at ? formatDate(tracking.last_synced_at, "dd MMM yyyy HH:mm") : "—"}
            </Field>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
