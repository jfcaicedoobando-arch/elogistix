import { AlertCircle, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listNavierasSoportadas } from "@/lib/jsoncargo/navieras";
import { getExternalTracking } from "@/lib/jsoncargo/externalTracking";
import { carrierLabel } from "@/lib/jsoncargo/containerPrefixes";
import type { JsonCargoShippingLine } from "@/lib/jsoncargo/navieras";
import type { useTrackingLiveCard } from "@/hooks/embarque";

interface Props {
  ctrl: ReturnType<typeof useTrackingLiveCard>;
  naviera: string | null;
  contenedor: string | null;
  blMaster: string | null | undefined;
  readOnly?: boolean;
}

function SinContenedorAlert() {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded bg-muted/30">
      <Info className="h-4 w-4 mt-0.5 shrink-0" />
      <p>Captura el número de contenedor en el embarque para activar el tracking automático.</p>
    </div>
  );
}

function NoSoportadaAlert({ naviera, contenedor, blMaster }: { naviera: string | null; contenedor: string | null; blMaster: string | null | undefined }) {
  const ext = getExternalTracking(naviera, contenedor, blMaster);
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded bg-muted/30">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="space-y-2 flex-1">
        <p className="font-medium">JSONCargo no soporta la naviera "{naviera ?? "—"}".</p>
        <p>Consulta el tracking directamente en el sitio del transportista. Soportadas por JSONCargo: {listNavierasSoportadas().map((n) => n.label).join(", ")}.</p>
        {ext && (
          <Button asChild size="sm" variant="outline" className="mt-1">
            <a href={ext.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              {ext.label}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function PrefixMismatchAlert({ naviera, detectedPrefix, suggestions, readOnly }: { naviera: string | null; detectedPrefix: string | null; suggestions: JsonCargoShippingLine[]; readOnly?: boolean }) {
  return (
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
  );
}

function FailedAlert({ reason }: { reason: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 text-xs text-destructive p-3 rounded bg-destructive/5">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Error al consultar JSONCargo</p>
        <p className="mt-0.5">{reason ?? "—"}</p>
      </div>
    </div>
  );
}

export function TrackingWarnings({ ctrl, naviera, contenedor, blMaster, readOnly }: Props) {
  const { tracking, isLoading, sinContenedor, noSoportada, prefixMismatch, showPrefixWarning, suggestions, detectedPrefix } = ctrl;
  const backendPrefixError = tracking?.status === "failed" && /prefix not found/i.test(tracking.failed_reason ?? "");
  const showIdle = !sinContenedor && !noSoportada && !prefixMismatch && !tracking && !isLoading;
  const showFailed = tracking?.status === "failed" && !backendPrefixError;

  return (
    <>
      {sinContenedor && <SinContenedorAlert />}
      {!sinContenedor && noSoportada && <NoSoportadaAlert naviera={naviera} contenedor={contenedor} blMaster={blMaster} />}
      {showPrefixWarning && <PrefixMismatchAlert naviera={naviera} detectedPrefix={detectedPrefix} suggestions={suggestions} readOnly={readOnly} />}
      {showIdle && (
        <p className="text-xs text-muted-foreground">
          {readOnly ? "Aún no hay datos de tracking en vivo." : "Sin sincronización previa. Pulsa Sincronizar para consultar JSONCargo."}
        </p>
      )}
      {showFailed && <FailedAlert reason={tracking?.failed_reason} />}
    </>
  );
}
