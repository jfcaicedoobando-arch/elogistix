import { Button } from "@/components/ui/button";
import { FileText, FileCode2 } from "lucide-react";
import { openFacturaInNewTab } from "@/services/storage";
import { descargarCfdiFacturapi, esUrlFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";

import { notifyError } from "@/lib/ui/appFeedback";
import { Hint } from "@/components/shared/Hint";
import { DescargaCfdiError, esAutenticacionDescarga, mensajeDescargaCfdi } from "@/features/facturacion/domain/descargaCfdiError";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
interface Props {
  stored: string | null;
  kind: "pdf" | "xml";
  size?: "sm" | "icon";
  className?: string;
  /** Si se proporciona, se usa el proxy FacturApi cuando `stored` apunta a su dominio o está vacío. */
  facturaId?: string;
  /** Igual que facturaId pero para REP de un pago. */
  pagoId?: string;
  /** Igual que facturaId pero para una nota de crédito timbrada. */
  notaCreditoId?: string;
}

export function FacturaDownloadButton({ stored, kind, size = "icon", className, facturaId, pagoId, notaCreditoId }: Props) {
  const Icon = kind === "pdf" ? FileText : FileCode2;
  const colorClass = kind === "pdf" ? "text-destructive" : "text-info";
  const label = kind === "pdf" ? "Descargar PDF" : "Descargar XML";

  const descargar = async (scope = captureAuthOperationScope()) => {
    if (!scope.isCurrent()) return;
    try {
      const usarProxy = (!stored || esUrlFacturapi(stored)) && (facturaId || pagoId || notaCreditoId);
      if (usarProxy) {
        await descargarCfdiFacturapi({ tipo: kind, facturaId, pagoId, notaCreditoId });
      } else if (stored) {
        await openFacturaInNewTab(stored);
      } else {
        throw new Error("Archivo no disponible");
      }
    } catch (err) {
      if (!scope.isCurrent() || err instanceof AuthOperationChangedError) return;
      notifyError(undefined, {
        title: kind === "pdf" ? "No se pudo abrir el PDF" : "No se pudo abrir el XML",
        description: mensajeDescargaCfdi(err),
        error: err,
        method: "FEATURES_FACTURACION_COMPONENTS_FACTURADOWNLOADBUTTON_1",
        context: { facturaId, pagoId, notaCreditoId, tipo: kind, originalRequestId: err instanceof DescargaCfdiError ? err.originalRequestId : undefined },
        requestId: err instanceof DescargaCfdiError ? err.requestId : undefined,
        action: esAutenticacionDescarga(err) ? { label: "Reintentar descarga", onClick: () => { void descargar(scope); } } : undefined,
      });
    }
  };

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    void descargar();
  };


  if (size === "icon") {
    return (
      <Hint label={label}>
        <Button
          variant="outline"
          size="icon"
          className={className ?? "min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0"}
          aria-label={label}
          onClick={onClick}
        >
          <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
        </Button>
      </Hint>
    );
  }
  return (
    <Hint label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={className ?? "inline-flex"}
      >
        <Icon className={`h-3.5 w-3.5 ${colorClass} hover:opacity-80`} />
      </button>
    </Hint>
  );
}
