/**
 * Toolbar de filtro para la lista de conceptos_costo pendientes en
 * `VincularEmbarqueSection`. Puro presentacional.
 */
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  filtro: string;
  onFiltro: (v: string) => void;
  soloMarcados: boolean;
  onSoloMarcados: (v: boolean) => void;
  visibles: number;
  total: number;
}

export function VincularFiltroToolbar({
  filtro, onFiltro, soloMarcados, onSoloMarcados, visibles, total,
}: Props) {
  const filtroActivo = filtro.trim().length > 0 || soloMarcados;
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => onFiltro(e.target.value)}
            placeholder="Filtrar por concepto, expediente o monto…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant={soloMarcados ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => onSoloMarcados(!soloMarcados)}
        >
          Sólo marcados
        </Button>
        {filtroActivo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => { onFiltro(""); onSoloMarcados(false); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>
      {filtroActivo && (
        <p className="text-xs text-muted-foreground">
          Mostrando {visibles} de {total} concepto{total === 1 ? "" : "s"}
        </p>
      )}
    </>
  );
}
