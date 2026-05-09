import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Ship, MapPin, Anchor, AlertCircle, Info, CheckCircle2, Search, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { formatDate } from "@/lib/formatters";
import { mapNavieraToJsonCargo, listNavierasSoportadas } from "@/lib/jsoncargo/navieras";
import { getExternalTracking } from "@/lib/jsoncargo/externalTracking";
import {
  validatePrefixMatchesNaviera,
  carrierLabel,
} from "@/lib/jsoncargo/containerPrefixes";
import {
  useJsonCargoTracking,
  useSyncJsonCargo,
  extractSummary,
  PrefixMismatchError,
} from "@/hooks/embarque/useJsonCargoTracking";
import { DialogBolContainers } from "./DialogBolContainers";

interface Props {
  embarqueId: string;
  modo: string | null;
  naviera: string | null;
  contenedor: string | null;
  blMaster?: string | null;
  /** Si true, no muestra botón de sincronizar (portal cliente). */
  readOnly?: boolean;
}

export function TrackingLiveCard({ embarqueId, modo, naviera, contenedor, blMaster, readOnly }: Props) {
  const { toast } = useToast();
  const { data: tracking, isLoading } = useJsonCargoTracking(embarqueId);
  const sync = useSyncJsonCargo();
  const [bolDialogOpen, setBolDialogOpen] = useState(false);

  // Solo aplica a marítimo
  if (modo !== "Marítimo") return null;

  const sl = mapNavieraToJsonCargo(naviera);
  const noSoportada = !sl;
  const sinContenedor = !contenedor;
  const summary = tracking?.raw_payload ? extractSummary(tracking.raw_payload) : null;

  // Validación de prefix vs naviera (local, no consume cuota)
  const prefixCheck = validatePrefixMatchesNaviera(contenedor, sl);
  const prefixMismatch = !sinContenedor && !noSoportada && !prefixCheck.valid;

  // Detecta también si el backend ya guardó un fallo por prefix
  const backendPrefixError = tracking?.status === "failed" &&
    /prefix not found/i.test(tracking.failed_reason ?? "");

  // Estado de error tras una mutación del cliente
  const mutationPrefixError = sync.error instanceof PrefixMismatchError
    ? (sync.error as PrefixMismatchError)
    : null;

  const handleSync = async () => {
    try {
      const res = await sync.mutateAsync({ embarqueId, contenedor, naviera });
      if (res.throttled) {
        toast({ title: "Sincronización reciente", description: res.message ?? "Espera unos minutos." });
      } else if (res.ok) {
        notifySuccess(toast, {
          title: "Tracking actualizado",
          description: res.eventos_creados ? `${res.eventos_creados} evento(s) nuevo(s).` : "Sin cambios desde la última sincronización.",
        });
      } else {
        notifyError(toast, { title: "No se pudo sincronizar", description: res.error ?? "Error desconocido" });
      }
    } catch (err) {
      if (err instanceof PrefixMismatchError) {
        notifyError(toast, {
          title: "Prefix no coincide con la naviera",
          description: `El prefix ${err.prefix} no corresponde a ${naviera ?? "—"}. Verifica la naviera.`,
        });
        return;
      }
      notifyError(toast, { title: "Error de tracking", description: err instanceof Error ? err.message : "Error" });
    }
  };

  // Sugerencias finales (UI consolidada)
  const suggestions = mutationPrefixError?.suggestions ?? prefixCheck.suggestions;
  const detectedPrefix = mutationPrefixError?.prefix ?? prefixCheck.prefix;
  const showPrefixWarning = prefixMismatch || mutationPrefixError != null || backendPrefixError;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ship className="h-4 w-4 text-accent" />
          Tracking en vivo (JSONCargo)
          {tracking?.status === "ok" && <Badge variant="secondary" className="text-[10px]">Conectado</Badge>}
          {tracking?.status === "failed" && <Badge variant="destructive" className="text-[10px]">Error</Badge>}
        </CardTitle>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {!noSoportada && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBolDialogOpen(true)}
                        disabled={!blMaster}
                      >
                        <Search className="h-3.5 w-3.5 mr-1" />
                        Buscar por BL Master
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!blMaster && (
                    <TooltipContent>
                      Captura el BL Master en Datos / Ruta para usar esta búsqueda.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
            {!noSoportada && !sinContenedor && !prefixMismatch && (
              <Button size="sm" variant="outline" onClick={handleSync} disabled={sync.isPending}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
                {tracking ? "Actualizar" : "Sincronizar"}
              </Button>
            )}
          </div>
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
            <div className="space-y-2 flex-1">
              <p className="font-medium">JSONCargo no soporta la naviera "{naviera ?? "—"}".</p>
              <p>Consulta el tracking directamente en el sitio del transportista. Soportadas por JSONCargo: {listNavierasSoportadas().map((n) => n.label).join(", ")}.</p>
              {(() => {
                const ext = getExternalTracking(naviera, contenedor, blMaster);
                if (!ext) return null;
                return (
                  <Button asChild size="sm" variant="outline" className="mt-1">
                    <a href={ext.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      {ext.label}
                    </a>
                  </Button>
                );
              })()}
            </div>
          </div>
        )}

        {showPrefixWarning && (
          <div className="flex items-start gap-2 text-xs text-destructive p-3 rounded bg-destructive/5 border border-destructive/20">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="font-medium">
                El prefix <span className="font-mono">{detectedPrefix ?? "—"}</span> del contenedor no coincide con la naviera <span className="font-semibold">{naviera ?? "—"}</span>.
              </p>
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Suele pertenecer a:</span>
                  {suggestions.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">{carrierLabel(c)}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Prefix no registrado. Si crees que es válido, contacta a <span className="font-mono">support@jsoncargo.com</span> para registrar el prefix con la naviera correcta.
                </p>
              )}
              {!readOnly && (
                <p className="text-muted-foreground pt-1">
                  Edita el embarque para corregir la naviera y vuelve a sincronizar.
                </p>
              )}
            </div>
          </div>
        )}

        {!sinContenedor && !noSoportada && !prefixMismatch && !tracking && !isLoading && (
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? "Aún no hay datos de tracking en vivo."
              : "Sin sincronización previa. Pulsa Sincronizar para consultar JSONCargo."}
          </p>
        )}

        {tracking?.status === "failed" && !backendPrefixError && (
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
      {!readOnly && (
        <DialogBolContainers
          open={bolDialogOpen}
          onOpenChange={setBolDialogOpen}
          embarqueId={embarqueId}
          blMaster={blMaster ?? null}
          naviera={naviera}
          contenedorActual={contenedor}
        />
      )}
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
