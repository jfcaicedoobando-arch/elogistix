import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import { useNavieras } from "@/features/catalogos/hooks/useNavieras";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

/**
 * Copia texto al portapapeles con fallback para entornos donde la Clipboard API
 * está bloqueada por Permissions-Policy (ej. iframes de preview). Cae a un
 * <textarea> temporal + document.execCommand("copy") que sí funciona.
 */
async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cae al fallback.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}


interface Props {
  modo: string;
  naviera: string | null;
  aerolinea: string | null;
  blMaster: string | null;
  mawb: string | null;
}

/**
 * Tarjeta de acciones rápidas para consultar tracking en la web de la naviera/aerolínea.
 * - Botón para abrir la URL de tracking de la naviera (catálogo en tabla `navieras`).
 * - Botón para copiar el BL Master / MAWB al portapapeles.
 */
interface CarrierInfo {
  esMaritimo: boolean;
  carrier: string | null;
  referencia: string | null;
  refLabel: "BL Master" | "MAWB";
}

function getCarrierInfo(props: Props): CarrierInfo {
  const esMaritimo = props.modo === "Marítimo";
  return {
    esMaritimo,
    carrier: esMaritimo ? props.naviera : props.aerolinea,
    referencia: esMaritimo ? props.blMaster : props.mawb,
    refLabel: esMaritimo ? "BL Master" : "MAWB",
  };
}

function getTrackingTooltip(referencia: string | null, esMaritimo: boolean, refLabel: string): string {
  if (!referencia) return `Falta el ${refLabel}`;
  if (!esMaritimo) return "El tracking aéreo se consulta directamente en la web de la aerolínea";
  return "Esta naviera no tiene URL de tracking configurada — pídele al admin que la agregue en Configuración › Navieras";
}

function resolveTrackingUrl(
  navieras: Array<{ name: string; code: string; tracking_url_template: string | null }>,
  naviera: string | null,
  referencia: string | null,
  esMaritimo: boolean,
): string | null {
  if (!esMaritimo || !naviera || !referencia) return null;
  const row = navieras.find((n) => n.name === naviera || n.code === naviera);
  const template = row?.tracking_url_template ?? null;
  if (!template) return null;
  return template.replace("{BL}", encodeURIComponent(referencia.trim()));
}

export function TrackingNavieraActions(props: Props) {
  const { data: navieras = [] } = useNavieras();
  const [copied, setCopied] = useState(false);

  const { esMaritimo, carrier, referencia, refLabel } = getCarrierInfo(props);
  const trackingUrl = resolveTrackingUrl(navieras, props.naviera, referencia, esMaritimo);

  const handleCopy = async () => {
    if (!referencia) return;
    const texto = referencia.trim();
    const ok = await copyTextWithFallback(texto);
    if (ok) {
      setCopied(true);
      notifySuccess(undefined, { title: `${refLabel} copiado`, description: texto });
      setTimeout(() => setCopied(false), 2000);
    } else {
      notifyError(undefined, {
        title: "No se pudo copiar",
        description: `Copia manualmente: ${texto}`,
        method: "TRACKING_COPY_BL",
      });
    }
  };

  const handleOpen = () => {
    if (!trackingUrl) return;
    window.open(trackingUrl, "_blank", "noopener,noreferrer");
  };

  if (!carrier && !referencia) {
    const captura = esMaritimo ? "naviera y el BL Master" : "aerolínea y el MAWB";
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Captura la {captura} en el tab Resumen para habilitar las consultas de tracking.
        </AlertDescription>
      </Alert>
    );
  }

  const carrierLabel = carrier ?? "la naviera";
  const carrierBtnLabel = carrier ?? "naviera";
  const referenciaDisplay = referencia ?? "—";
  const copyLabel = copied ? "Copiado" : `Copiar ${refLabel}`;
  const CopyIcon = copied ? Check : Copy;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm">
            <div className="font-medium">Consultar tracking en {carrierLabel}</div>
            <div className="text-xs text-muted-foreground">
              {refLabel}: <span className="font-mono">{referenciaDisplay}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" variant="outline" onClick={handleCopy} disabled={!referencia}>
                      <CopyIcon className="h-4 w-4 mr-1" />
                      {copyLabel}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!referencia && <TooltipContent>Captura primero el {refLabel} en Resumen</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" onClick={handleOpen} disabled={!trackingUrl}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir tracking de {carrierBtnLabel}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!trackingUrl && (
                  <TooltipContent>
                    {getTrackingTooltip(referencia, esMaritimo, refLabel)}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          💡 Pega el {refLabel} en la página de la naviera, copia el último evento, regresa y registra el
          evento abajo ↓. Actualiza el tracking al menos cada 7 días y siempre 48&nbsp;h antes del arribo.
        </p>
      </CardContent>
    </Card>
  );
}

