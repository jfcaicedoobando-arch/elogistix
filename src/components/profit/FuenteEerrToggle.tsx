/**
 * Toggle unificado Embarques/Facturas para elegir la fuente del EERR.
 * Reemplaza el ToggleGroup inline del Dashboard y el Select de la página
 * EERR (auditoría Fase H, hallazgo #2 — misma preferencia, dos UIs).
 */
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFuenteEerr, type FuenteEERR } from "@/features/profit/hooks/useFuenteEerr";

interface Props {
  /** Etiqueta accesible para el grupo. */
  ariaLabel?: string;
  className?: string;
}

export function FuenteEerrToggle({ ariaLabel = "Fuente del Estado de Resultados", className }: Props) {
  const { fuente, setFuente } = useFuenteEerr();
  return (
    <ToggleGroup
      type="single"
      value={fuente}
      onValueChange={(v) => v && setFuente(v as FuenteEERR)}
      aria-label={ariaLabel}
      className={className}
    >
      <ToggleGroupItem
        value="embarques"
        aria-label="Fuente operativa (por ETA de embarque)"
        title="Operativa: conceptos del embarque cuya ETA cae en el mes"
      >
        Embarques
      </ToggleGroupItem>
      <ToggleGroupItem
        value="facturas"
        aria-label="Fuente devengada (facturas emitidas y CxP)"
        title="Devengada: facturas emitidas (CxC) menos NC, contra CxP del mismo mes"
      >
        Facturas
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
