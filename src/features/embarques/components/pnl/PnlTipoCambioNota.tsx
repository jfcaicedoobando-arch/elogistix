/**
 * Nota de trazabilidad del tipo de cambio del embarque (v13.553.0).
 *
 * El T/C guardado en el embarque es una foto congelada al capturarlo. Aquí se
 * compara contra el DOF de esa fecha y, si el embarque sigue abierto, se ofrece
 * alinearlo de forma explícita (nunca automática, para no mover utilidades
 * históricas sin dejar rastro).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatFechaEs } from "@/lib/formatters";
import { usePermissions } from "@/hooks/shared/usePermissions";
import {
  useAlinearTcEmbarqueDof,
  useEmbarqueTcContexto,
} from "@/features/embarques/hooks/useTcEmbarqueDof";

interface Props {
  embarqueId: string;
  /** T/C que el P&L está usando (viene de la RPC). */
  tcUsd: number;
  tcEur: number;
}

const tc = (valor: number) => (valor > 0 ? valor.toFixed(4) : "—");

export function PnlTipoCambioNota({ embarqueId, tcUsd, tcEur }: Props) {
  const { data: ctx } = useEmbarqueTcContexto(embarqueId);
  const alinear = useAlinearTcEmbarqueDof(embarqueId);
  const { canEdit } = usePermissions();

  const dofUsd = ctx?.dof?.usdMxn ?? 0;
  const desviacion = ctx?.desviacionPct ?? null;
  const puedeAlinear = Boolean(ctx?.editable) && canEdit && dofUsd > 0 && ctx?.fueraDeDof;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {/* UIA-10: el servicio normaliza el TC ausente a 0; 0 se muestra como "—". */}
        Tipos de cambio del embarque: USD {tc(tcUsd)} · EUR {tc(tcEur)}
        {ctx ? ` · congelados al capturarlo el ${formatFechaEs(ctx.fechaReferencia)}` : ""}
      </p>

      {ctx && dofUsd > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            DOF del {formatFechaEs(ctx.dof?.fecha ?? ctx.fechaReferencia)}: {dofUsd.toFixed(4)}
          </span>
          {ctx.fueraDeDof ? (
            <Badge variant="outline" className="border-warning text-warning">
              Capturado a mano · {desviacion != null && desviacion > 0 ? "+" : ""}
              {desviacion?.toFixed(2)}% vs. DOF
            </Badge>
          ) : (
            <Badge variant="outline" className="border-success text-success">
              Coincide con el DOF
            </Badge>
          )}
          {puedeAlinear && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Alinear el tipo de cambio al DOF">
                  Usar el del DOF
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Alinear el tipo de cambio al DOF?</AlertDialogTitle>
                  <AlertDialogDescription>
                    El T/C USD del embarque pasará de {tc(ctx.tcUsd)} a {dofUsd.toFixed(4)} (DOF del{" "}
                    {formatFechaEs(ctx.dof?.fecha ?? ctx.fechaReferencia)}). Esto recalcula el P&L y
                    todas las conversiones a pesos de este expediente. Queda registrado en la
                    bitácora.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => alinear.mutate(ctx.fechaReferencia)}
                    disabled={alinear.isPending}
                  >
                    Sí, usar el del DOF
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {ctx.fueraDeDof && !ctx.editable && (
            <span>El embarque está {ctx.estado?.toLowerCase()}: el T/C ya no puede cambiarse.</span>
          )}
        </div>
      )}
    </div>
  );
}
