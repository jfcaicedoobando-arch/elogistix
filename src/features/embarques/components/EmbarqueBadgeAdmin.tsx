/**
 * v13.89.0 — Sub-badge "Admin pendiente · N" / "Listo para cerrar".
 *
 * Sólo se muestra en embarques que ya cerraron su ciclo operativo
 * (Entregado o EIR) pero no han sido marcados como Cerrado.
 *
 * Reutiliza `embarque_admin_pendientes_resumen` (BD) para no duplicar lógica.
 */
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleAlert, CheckCircle2 } from "lucide-react";
import { useAdminPendienteResumen } from "@/features/embarques/hooks/useAdminPendienteResumen";

const ESTADOS_ADMIN_PENDIENTE = new Set(["Entregado", "EIR", "Por liquidar"]);

interface Props {
  embarqueId: string;
  estado: string;
  /** Navega a la pestaña de cierre del embarque (?tab=cierre). */
  onIrACierre?: () => void;
}

export function EmbarqueBadgeAdmin({ embarqueId, estado, onIrACierre }: Props) {
  const aplica = ESTADOS_ADMIN_PENDIENTE.has(estado);
  const { data, isLoading } = useAdminPendienteResumen(embarqueId, aplica);

  if (!aplica || isLoading || !data) return null;

  if (data.pendientes === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onIrACierre}
            aria-label="Listo para cerrar. Ir a la pestaña de cierre"
            className="inline-flex"
          >
            <Badge variant="success" className="gap-1 cursor-pointer">
              <CheckCircle2 className="h-3 w-3" />
              Listo para cerrar
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent>Todos los pendientes administrativos están cubiertos.</TooltipContent>
      </Tooltip>
    );
  }

  const detalles: string[] = [];
  if (data.cxc_pendiente > 0.01) detalles.push(`CxC: ${formatCurrency(data.cxc_pendiente, "MXN")}`);
  if (data.cxp_pendiente > 0.01) detalles.push(`CxP: ${formatCurrency(data.cxp_pendiente, "MXN")}`);
  if (data.venta_no_facturada > 0.01) detalles.push(`Por facturar: ${formatCurrency(data.venta_no_facturada, "MXN")}`);
  if (data.docs_faltantes > 0) detalles.push(`${data.docs_faltantes} doc(s) faltantes`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onIrACierre}
          aria-label={`Admin pendiente, ${data.pendientes} elemento(s). Ir a la pestaña de cierre`}
          className="inline-flex"
        >
          <Badge variant="warning" className="gap-1 cursor-pointer">
            <CircleAlert className="h-3 w-3" />
            Admin pendiente · {data.pendientes}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-0.5 text-xs">
          {detalles.map((d) => <div key={d}>• {d}</div>)}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
