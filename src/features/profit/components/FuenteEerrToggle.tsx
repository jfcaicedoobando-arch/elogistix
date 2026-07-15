/**
 * Toggle unificado Embarques/Facturas para elegir la fuente del EERR.
 * Reemplaza el ToggleGroup inline del Dashboard y el Select de la página
 * EERR (auditoría Fase H, hallazgo #2 — misma preferencia, dos UIs).
 */
import { Info } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFuenteEerr, type FuenteEERR } from "@/features/profit/hooks/useFuenteEerr";

interface Props {
  /** Etiqueta accesible para el grupo. */
  ariaLabel?: string;
  className?: string;
}

export function FuenteEerrToggle({ ariaLabel = "Fuente del Estado de Resultados", className }: Props) {
  const { fuente, setFuente } = useFuenteEerr();
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <ToggleGroup
        type="single"
        value={fuente}
        onValueChange={(v) => v && setFuente(v as FuenteEERR)}
        aria-label={ariaLabel}
      >
        <ToggleGroupItem
          value="embarques"
          aria-label="Fuente operativa (por ETA de embarque)"
        >
          Embarques
        </ToggleGroupItem>
        <ToggleGroupItem
          value="facturas"
          aria-label="Fuente devengada (facturas emitidas y CxP)"
        >
          Facturas
        </ToggleGroupItem>
      </ToggleGroup>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="¿Qué significa cada fuente?"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm space-y-2" align="end">
          <div>
            <div className="font-semibold">Embarques (Operativa)</div>
            <p className="text-muted-foreground text-xs">
              Suma conceptos de venta y costo de embarques cuya <strong>ETA</strong> cae en el mes.
              Refleja la utilidad real del negocio operado, sin importar cuándo se factura.
            </p>
          </div>
          <div>
            <div className="font-semibold">Facturas (Devengada)</div>
            <p className="text-muted-foreground text-xs">
              Suma facturas emitidas (menos notas de crédito) contra CxP recibidas en el mes.
              Coincide con lo contable pero puede diferir de la operativa por facturación diferida.
            </p>
          </div>
          <p className="text-xs italic pt-1 border-t">
            Es normal que las cifras difieran; comparar ambas ayuda a detectar rezagos de facturación.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
