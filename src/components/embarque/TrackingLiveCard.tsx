import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Ship, MapPin, Anchor, AlertCircle, Info, CheckCircle2, Search, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { listNavierasSoportadas } from "@/lib/jsoncargo/navieras";
import { getExternalTracking } from "@/lib/jsoncargo/externalTracking";
import { carrierLabel } from "@/lib/jsoncargo/containerPrefixes";
import { useTrackingLiveCard } from "@/hooks/embarque/useTrackingLiveCard";
import { DialogBolContainers } from "./DialogBolContainers";

interface Props {
  embarqueId: string;
  modo: string | null;
  naviera: string | null;
  contenedor: string | null;
  blMaster?: string | null;
  etd?: string | null;
  eta?: string | null;
  fechaLlegadaReal?: string | null;
  /** Si true, no muestra botón de sincronizar (portal cliente). */
  readOnly?: boolean;
}

export function TrackingLiveCard({ embarqueId, modo, naviera, contenedor, blMaster, etd, eta, fechaLlegadaReal, readOnly }: Props) {
  // Solo aplica a marítimo. Hook se llama siempre arriba para respetar reglas de hooks.
  const ctrl = useTrackingLiveCard({ embarqueId, naviera, contenedor, etd, eta, fechaLlegadaReal, readOnly });

  if (modo !== "Marítimo") return null;

  const {
    tracking, isLoading, summary, sync, applyFechas,
    bolDialogOpen, setBolDialogOpen, setFechasDismissed,
    noSoportada, sinContenedor, prefixMismatch, showPrefixWarning,
    suggestions, detectedPrefix, fechasPropuestas, onSync, onAplicarFechas,
  } = ctrl;

  const backendPrefixError =
    tracking?.status === "failed" && /prefix not found/i.test(tracking.failed_reason ?? "");

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
              <Button size="sm" variant="outline" onClick={onSync} disabled={sync.isPending}>
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

        {fechasPropuestas && summary && (
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
