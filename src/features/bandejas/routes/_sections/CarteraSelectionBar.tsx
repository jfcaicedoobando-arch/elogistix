/**
 * Barra de selección de Cartera (v13.490.0).
 *
 * Aparece en cuanto hay facturas marcadas: recuerda al usuario que está en
 * modo selección, explica por qué el cobro en lote no aplica (clientes o
 * monedas mezclados) y permite limpiar la selección de un clic.
 */
import { Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LoteCobroSeleccion } from "./carteraLote";

interface Props {
  total: number;
  lote: LoteCobroSeleccion | null;
  onCobroLote: () => void;
  onLimpiar: () => void;
}

function motivoInvalido(total: number): string {
  if (total < 2) return "Selecciona al menos 2 facturas para un cobro en lote.";
  return "Las facturas seleccionadas deben ser del mismo cliente y la misma moneda.";
}

export function CarteraSelectionBar({ total, lote, onCobroLote, onLimpiar }: Props) {
  if (total === 0) return null;

  return (
    <div
      role="region"
      aria-label="Facturas seleccionadas"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <Badge variant="secondary" className="tabular-nums">
        {total} {total === 1 ? "factura" : "facturas"}
      </Badge>
      {lote ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{lote.clienteNombre || "Cliente"}</span>
          {" · "}
          {lote.moneda}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{motivoInvalido(total)}</p>
      )}
      <p className="hidden text-xs text-muted-foreground lg:block">
        Modo selección: al hacer clic en una fila se marca o desmarca. Usa el folio para abrir el
        detalle.
      </p>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" onClick={onCobroLote} disabled={!lote}>
          <Layers className="mr-2 h-4 w-4" />
          Cobro en lote
        </Button>
        <Button size="sm" variant="ghost" onClick={onLimpiar}>
          <X className="mr-1 h-4 w-4" />
          Limpiar selección
        </Button>
      </div>
    </div>
  );
}
