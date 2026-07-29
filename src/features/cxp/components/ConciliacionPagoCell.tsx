/**
 * Celda de conciliación bancaria dentro de la tabla de pagos.
 * Muestra badge del estado (Conciliado / Sin conciliar) y un popover para
 * vincular/desvincular con un movimiento BBVA candidato.
 *
 * v13.190.0 · Ola 2 · Item 3
 */
import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Link2, Link2Off, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useAuth } from "@/lib/contexts/AuthContext";
import { sugerirMovsParaPagoProveedor } from "@/features/cxp/services/conciliacionBancaria";
import { conciliarConPago, desconciliarMovimiento } from "@/features/tesoreria/services/conciliacion";
import { queryKeys } from "@/lib/query";

interface MovimientoVinculado {
  id: string;
  fecha: string;
  concepto: string | null;
  referencia: string | null;
  cargo: number | string;
}

interface Props {
  pagoId: string;
  fechaPago: string;
  monto: number;
  cuentaBancariaId: string | null;
  movimiento: MovimientoVinculado | null;
  disabled?: boolean;
}

export function ConciliacionPagoCell({
  pagoId, fechaPago, monto, cuentaBancariaId, movimiento, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const candidatos = useQuery({
    queryKey: queryKeys.cxp.conciliacionCandidatos(pagoId),
    queryFn: () => sugerirMovsParaPagoProveedor({
      id: pagoId, fecha_pago: fechaPago, monto, cuenta_bancaria_id: cuentaBancariaId,
    }),
    enabled: open && !movimiento,
    staleTime: 60_000,
  });

  const vincular = useMutation({
    mutationFn: (movId: string) => conciliarConPago(movId, "cxp", pagoId, user?.id ?? null),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Movimiento vinculado al pago" });
      qc.invalidateQueries({ queryKey: queryKeys.pagosProveedor.all });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      setOpen(false);
    },
    onError: (err: Error) => notifyError(undefined, {
      title: `No se pudo vincular: ${err.message}`, error: err,
      method: "FEATURES_CXP_CONCILIACION_VINCULAR",
    }),
  });

  const desvincular = useMutation({
    mutationFn: (movId: string) => desconciliarMovimiento(movId),
    onSuccess: () => {
      notifySuccess(undefined, { title: "Movimiento desvinculado" });
      qc.invalidateQueries({ queryKey: queryKeys.pagosProveedor.all });
      qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      setOpen(false);
    },
    onError: (err: Error) => notifyError(undefined, {
      title: `No se pudo desvincular: ${err.message}`, error: err,
      method: "FEATURES_CXP_CONCILIACION_DESVINCULAR",
    }),
  });

  if (movimiento) {
    return (
      <div className="flex items-center gap-2">
        <ToneBadge tone="success" size="md">
          <CheckCircle2 className="h-3 w-3" /> Conciliado
        </ToneBadge>

        <div className="flex flex-col text-label text-muted-foreground min-w-0">
          <span className="tabular-nums">{format(new Date(movimiento.fecha + "T00:00:00"), "dd/MM/yy")} · {formatCurrency(Number(movimiento.cargo), "MXN")}</span>
          {movimiento.referencia && <span className="truncate">Ref: {movimiento.referencia}</span>}
        </div>
        {!disabled && (
          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => desvincular.mutate(movimiento.id)}
            disabled={desvincular.isPending}
            title="Desvincular movimiento"
          >
            {desvincular.isPending
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Link2Off className="h-3 w-3" />}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline" size="sm"
          className="h-7 px-2 text-label border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
          disabled={disabled}
        >
          <Link2 className="h-3 w-3 mr-1" /> Vincular banco
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b bg-muted/30">
          <p className="text-xs font-medium">Movimientos bancarios candidatos</p>
          <p className="text-label text-muted-foreground">
            Monto ±$1 · fecha ±5 días · sólo Pendientes
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {candidatos.isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 mx-auto animate-spin mb-1" /> Buscando…
            </div>
          ) : (candidatos.data ?? []).length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No hay movimientos que coincidan.
            </p>
          ) : (
            <ul className="divide-y">
              {(candidatos.data ?? []).map((m) => (
                <li key={m.id} className="p-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium tabular-nums">
                        {format(new Date(m.fecha + "T00:00:00"), "dd/MM/yyyy")} · {formatCurrency(m.cargo, "MXN")}
                      </p>
                      {m.concepto && (
                        <p className="text-label text-muted-foreground truncate">{m.concepto}</p>
                      )}
                      {m.referencia && (
                        <p className="text-label text-muted-foreground">Ref: {m.referencia}</p>
                      )}
                      <p className="text-2xs text-muted-foreground/70 mt-0.5">
                        Δ ${m.delta_monto.toFixed(2)} · {m.delta_dias}d
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-label"
                      onClick={() => vincular.mutate(m.id)}
                      disabled={vincular.isPending}
                    >
                      {vincular.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : "Vincular"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
