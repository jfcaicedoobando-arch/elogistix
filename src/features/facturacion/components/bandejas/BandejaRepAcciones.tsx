/**
 * Barra de acciones de la bandeja "REP pendientes": timbra el REP de los pagos
 * seleccionados en una sola pasada (secuencial) sin salir de la bandeja.
 */
import { Button } from "@/components/ui/button";
import { Loader2, ReceiptText, X } from "lucide-react";

interface Props {
  seleccionados: number;
  enProceso: boolean;
  progreso: { hechos: number; total: number } | null;
  onTimbrar: () => void;
  onLimpiar: () => void;
}

export function BandejaRepAcciones(p: Props) {
  if (p.seleccionados === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{p.seleccionados}</strong> pago(s) seleccionado(s)
        {p.progreso ? ` · timbrando ${p.progreso.hechos} de ${p.progreso.total}…` : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={p.onTimbrar} disabled={p.enProceso}>
          {p.enProceso ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ReceiptText className="mr-2 h-4 w-4" />
          )}
          Timbrar REP seleccionados
        </Button>
        <Button size="sm" variant="ghost" onClick={p.onLimpiar} disabled={p.enProceso}>
          <X className="mr-2 h-4 w-4" />
          Limpiar selección
        </Button>
      </div>
    </div>
  );
}
