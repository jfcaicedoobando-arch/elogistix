/**
 * Celda de conciliación bancaria dentro de la tabla de pagos.
 * Muestra badge del estado (Conciliado / Sin conciliar) y un popover para
 * vincular/desvincular con un movimiento BBVA candidato.
 *
 * v13.190.0 · Ola 2 · Item 3
 */
import { ArrowLeftRight, CheckCircle2, Link2, Link2Off, Loader2 } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, formatFechaDia } from "@/lib/formatters";
import { useConciliacionPagoCellController } from "@/features/cxp/hooks/useConciliacionPagoCellController";
import { Hint } from "@/components/shared/Hint";

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
  const { open, setOpen, candidatos, vincular, desvincular } =
    useConciliacionPagoCellController({
      pagoId, fechaPago, monto, cuentaBancariaId, tieneMovimiento: !!movimiento,
    });


  if (movimiento) {
    return (
      <div className="flex items-center gap-2">
        <ToneBadge tone="success" size="md">
          <CheckCircle2 className="h-3 w-3" /> Conciliado
        </ToneBadge>

        <div className="flex flex-col text-label text-muted-foreground min-w-0">
          <span className="tabular-nums">{formatFechaDia(movimiento.fecha)} · {formatCurrency(Number(movimiento.cargo), "MXN")}</span>
          {movimiento.referencia && <span className="truncate">Ref: {movimiento.referencia}</span>}
        </div>
        {!disabled && (
          <Hint label="Desvincular movimiento">
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => desvincular.mutate(movimiento.id)}
              disabled={desvincular.isPending}
              aria-label="Desvincular movimiento"
            >
              {desvincular.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Link2Off className="h-3 w-3" />}
            </Button>
          </Hint>
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
          <p className="text-body-sm font-medium">Movimientos bancarios candidatos</p>
          <p className="text-label text-muted-foreground">
            Monto ±$1 · fecha ±5 días · sólo Pendientes
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {candidatos.isLoading ? (
            <EmptyStateInline loading message="Buscando…" density="compact" />
          ) : (candidatos.data ?? []).length === 0 ? (
            <EmptyStateInline
              icon={ArrowLeftRight}
              message="No hay movimientos que coincidan."
              density="compact"
            />
          ) : (
            <ul className="divide-y">
              {(candidatos.data ?? []).map((m) => (
                <li key={m.id} className="p-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium tabular-nums">
                        {formatFechaDia(m.fecha)} · {formatCurrency(m.cargo, "MXN")}
                      </p>
                      {m.concepto && (
                        <p className="text-label text-muted-foreground truncate">{m.concepto}</p>
                      )}
                      {m.referencia && (
                        <p className="text-label text-muted-foreground">Ref: {m.referencia}</p>
                      )}
                      <p className="text-label text-muted-foreground/70 mt-0.5">
                        Δ {formatCurrency(m.delta_monto, "MXN")} · {m.delta_dias}d
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-label"
                      onClick={() => vincular.mutate(m.id)}
                      disabled={vincular.isPending}
                    >
                      {vincular.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
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
