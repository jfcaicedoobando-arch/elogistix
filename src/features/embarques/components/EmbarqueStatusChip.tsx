/**
 * Chip consolidado del header de detalle de embarque (v13.300.12).
 * Agrupa Estado operativo · Modo · Sub-estado financiero en un solo badge
 * para reducir la saturación visual del header.
 */
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { cn } from "@/lib/utils";

type CobroStatus = "pendiente" | "parcial" | "pagado" | null | undefined;

interface Props {
  estado: string;
  modo: string;
  tieneProforma: boolean | null | undefined;
  cobroStatus: CobroStatus;
  className?: string;
}

interface FinancieroInfo {
  label: string;
  tone: "warning" | "neutral" | "success";
}

export function resolveFinancieroInfo(
  tieneProforma: boolean | null | undefined,
  cobroStatus: CobroStatus,
): FinancieroInfo {
  if (cobroStatus === "pagado") return { label: "Cobrado", tone: "success" };
  if (cobroStatus === "parcial") return { label: "Cobro parcial", tone: "neutral" };
  if (!tieneProforma) return { label: "Sin proforma", tone: "warning" };
  return { label: "Proforma", tone: "neutral" };
}

function Separator() {
  return <span aria-hidden className="opacity-40">·</span>;
}

export function EmbarqueStatusChip({
  estado,
  modo,
  tieneProforma,
  cobroStatus,
  className,
}: Props) {
  const fin = resolveFinancieroInfo(tieneProforma, cobroStatus);

  return (
    <Badge
      className={cn(
        "gap-1.5 px-2.5 py-1 text-xs font-medium",
        getEstadoColor(estado),
        className,
      )}
      aria-label={`Estado ${estado}, modo ${modo}, ${fin.label}`}
    >
      <ModoIcon modo={modo} size={12} />
      <span>{modo}</span>
      <Separator />
      <span className="font-semibold">{estado}</span>
      <Separator />
      <span
        className={cn(
          "inline-flex items-center gap-1",
          fin.tone === "warning" && "opacity-90",
          fin.tone === "neutral" && "opacity-75",
        )}
      >
        {fin.tone === "success" ? <CheckCircle2 className="h-3 w-3" /> : null}
        {fin.label}
      </span>
    </Badge>
  );
}
