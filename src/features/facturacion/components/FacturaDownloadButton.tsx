import { Button } from "@/components/ui/button";
import { FileText, FileCode2 } from "lucide-react";
import { openFacturaInNewTab } from "@/services/storage";
import { descargarCfdiFacturapi, esUrlFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";

import { notifyError } from "@/lib/ui/appFeedback";
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

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
      notifyError(undefined, { title: "No se pudo abrir el archivo",
        description: (err as Error).message, error: err, method: "FEATURES_FACTURACION_COMPONENTS_FACTURADOWNLOADBUTTON_1" });
    }
  };


  if (size === "icon") {
    return (
      <Button
        variant="outline"
        size="icon"
        className={className ?? "h-7 w-7"}
        title={label}
        aria-label={label}
        onClick={onClick}
      >
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
      </Button>
    );
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={className ?? "inline-flex"}
    >
      <Icon className={`h-3.5 w-3.5 ${colorClass} hover:opacity-80`} />
    </button>
  );
}
