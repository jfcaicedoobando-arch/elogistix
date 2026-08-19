/**
 * Nota de trazabilidad del tipo de cambio del embarque (v13.553.0).
 *
 * El T/C guardado en el embarque es una foto congelada al capturarlo. Aquí se
 * compara contra el DOF de esa fecha y, si el embarque sigue abierto, se ofrece
 * alinearlo de forma explícita (nunca automática, para no mover utilidades
 * históricas sin dejar rastro).
 */
import { Badge } from "@/components/ui/badge";
import { formatFechaEs } from "@/lib/formatters";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useEmbarqueTcContexto } from "@/features/embarques/hooks/useTcEmbarqueDof";
import type { EmbarqueTcContexto } from "@/features/embarques/services/tcEmbarqueDof";
import { PnlTcAlinearDialog } from "./PnlTcAlinearDialog";

interface Props {
  embarqueId: string;
  /** T/C que el P&L está usando (viene de la RPC). */
  tcUsd: number;
  tcEur: number;
}

const tc = (valor: number) => (valor > 0 ? valor.toFixed(4) : "—");

/** Etiqueta de estado: ¿coincide con el DOF o fue capturado a mano? */
function BadgeDof({ ctx }: { ctx: EmbarqueTcContexto }) {
  if (!ctx.fueraDeDof) {
    return (
      <Badge variant="outline" className="border-success text-success">
        Coincide con el DOF
      </Badge>
    );
  }
  const pct = ctx.desviacionPct ?? 0;
  return (
    <Badge variant="outline" className="border-warning text-warning">
      Capturado a mano · {pct > 0 ? "+" : ""}
      {pct.toFixed(2)}% vs. DOF
    </Badge>
  );
}

/** Comparación contra el DOF + acción de alineación. */
function ComparativoDof({ ctx, puedeAlinear }: { ctx: EmbarqueTcContexto; puedeAlinear: boolean }) {
  const fechaDof = ctx.dof?.fecha ?? ctx.fechaReferencia;
  return (
    <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
      <span>
        DOF del {formatFechaEs(fechaDof)}: {(ctx.dof?.usdMxn ?? 0).toFixed(4)}
      </span>
      <BadgeDof ctx={ctx} />
      {puedeAlinear && (
        <PnlTcAlinearDialog
          embarqueId={ctx.embarqueId}
          fecha={ctx.fechaReferencia}
          tcActual={ctx.tcUsd}
          tcDof={ctx.dof?.usdMxn ?? 0}
        />
      )}
      {ctx.fueraDeDof && !ctx.editable && (
        <span>El embarque está {ctx.estado?.toLowerCase()}: el T/C ya no puede cambiarse.</span>
      )}
    </div>
  );
}

export function PnlTipoCambioNota({ embarqueId, tcUsd, tcEur }: Props) {
  const { data: ctx } = useEmbarqueTcContexto(embarqueId);
  const { canEdit } = usePermissions();

  const dofUsd = ctx?.dof?.usdMxn ?? 0;
  const puedeAlinear = Boolean(ctx?.editable && ctx?.fueraDeDof && canEdit && dofUsd > 0);

  return (
    <div className="space-y-2">
      <p className="text-body-sm text-muted-foreground">
        Tipos de cambio del embarque: USD {tc(tcUsd)} · EUR {tc(tcEur)}
        {ctx ? ` · congelados al capturarlo el ${formatFechaEs(ctx.fechaReferencia)}` : ""}
      </p>
      {ctx && dofUsd > 0 && <ComparativoDof ctx={ctx} puedeAlinear={puedeAlinear} />}
    </div>
  );
}
