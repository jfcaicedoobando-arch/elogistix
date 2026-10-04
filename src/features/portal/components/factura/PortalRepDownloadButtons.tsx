/**
 * Defecto 6 — Los REP se descargan SIEMPRE por el proxy `facturapi-descargar`
 * (`descargarCfdiFacturapi`). Las URLs guardadas apuntan a FacturApi y exigen
 * la API key de la organización: abrirlas directo nunca funciona y expondría
 * un endpoint protegido.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, FileCode2, Loader2 } from "lucide-react";
import { descargarCfdiFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";
import { notifyError } from "@/lib/ui/appFeedback";
import { mensajeDescargaCfdi } from "@/features/facturacion/domain/descargaCfdiError";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

interface Props {
  pagoId: string;
  tienePdf: boolean;
  tieneXml: boolean;
}

export function PortalRepDownloadButtons({ pagoId, tienePdf, tieneXml }: Props) {
  const [descargando, setDescargando] = useState<"pdf" | "xml" | null>(null);
  if (!tienePdf && !tieneXml) return null;

  const descargar = async (tipo: "pdf" | "xml") => {
    const scope = captureAuthOperationScope();
    setDescargando(tipo);
    try {
      await descargarCfdiFacturapi({ tipo, pagoId });
    } catch (err) {
      if (!scope.isCurrent() || err instanceof AuthOperationChangedError) return;
      reportCaughtError(err, { feature: "portal", op: "descargar_rep", tipo }, { pagoId });
      notifyError(undefined, {
        title: `No se pudo descargar el REP ${tipo.toUpperCase()}`,
        description: mensajeDescargaCfdi(err),
        error: err,
        method: "PORTAL_DESCARGAR_REP",
        context: { pagoId, tipo },
      });
    } finally {
      if (scope.isCurrent()) setDescargando(null);
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {tienePdf && (
        <Button
          size="sm"
          variant="outline"
          disabled={descargando !== null}
          onClick={() => void descargar("pdf")}
        >
          {descargando === "pdf" ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <FileText className="size-4 mr-1" />
          )}
          REP PDF
        </Button>
      )}
      {tieneXml && (
        <Button
          size="sm"
          variant="outline"
          disabled={descargando !== null}
          onClick={() => void descargar("xml")}
        >
          {descargando === "xml" ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <FileCode2 className="size-4 mr-1" />
          )}
          REP XML
        </Button>
      )}
    </div>
  );
}
