import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import { useNavieras } from "@/hooks/catalogos/useNavieras";
import { useToast } from "@/hooks/shared";
import { notifySuccess } from "@/components/shared/utils/appFeedback";

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
export function TrackingNavieraActions({ modo, naviera, aerolinea, blMaster, mawb }: Props) {
  const { data: navieras = [] } = useNavieras();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const esMaritimo = modo === "Marítimo";
  const carrier = esMaritimo ? naviera : aerolinea;
  const referencia = esMaritimo ? blMaster : mawb;
  const refLabel = esMaritimo ? "BL Master" : "MAWB";

  const navieraRow = esMaritimo && naviera ? navieras.find((n) => n.name === naviera || n.code === naviera) : null;
  const template = navieraRow?.tracking_url_template ?? null;
  const trackingUrl = template && referencia ? template.replace("{BL}", encodeURIComponent(referencia.trim())) : null;

  const handleCopy = async () => {
    if (!referencia) return;
    await navigator.clipboard.writeText(referencia.trim());
    setCopied(true);
    notifySuccess(toast, { title: `${refLabel} copiado`, description: referencia.trim() });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    if (!trackingUrl) return;
    window.open(trackingUrl, "_blank", "noopener,noreferrer");
  };

  if (!carrier && !referencia) {
    return (
      <Alert variant="warning">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Captura la {esMaritimo ? "naviera y el BL Master" : "aerolínea y el MAWB"} en el tab Resumen
          para habilitar las consultas de tracking.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm">
            <div className="font-medium">Consultar tracking en {carrier ?? "la naviera"}</div>
            <div className="text-xs text-muted-foreground">
              {refLabel}: <span className="font-mono">{referencia ?? "—"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" variant="outline" onClick={handleCopy} disabled={!referencia}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? "Copiado" : `Copiar ${refLabel}`}
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
                      Abrir tracking de {carrier ?? "naviera"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!trackingUrl && (
                  <TooltipContent>
                    {!referencia
                      ? `Falta el ${refLabel}`
                      : !esMaritimo
                      ? "El tracking aéreo se consulta directamente en la web de la aerolínea"
                      : "Esta naviera no tiene URL de tracking configurada — pídele al admin que la agregue en Configuración › Navieras"}
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
