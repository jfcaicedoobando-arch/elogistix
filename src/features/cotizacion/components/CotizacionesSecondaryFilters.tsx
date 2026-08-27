/**
 * Filtros secundarios del listado de Cotizaciones (bandejas y togglers).
 *
 * Extraído de `Cotizaciones.tsx` para respetar el límite de 200 líneas
 * (Power of 10).
 */
import { AlertTriangle, Archive, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";

interface Props {
  soloAceptadasSinEmbarque: boolean;
  totalAceptadasSinEmbarque: number;
  filterSinCostos: boolean;
  incluirInactivas: boolean;
  setFilter: (clave: "aceptadasSinEmbarque" | "sinCostos" | "incluirInactivas", valor: string) => void;
}

export function CotizacionesSecondaryFilters({
  soloAceptadasSinEmbarque,
  totalAceptadasSinEmbarque,
  filterSinCostos,
  incluirInactivas,
  setFilter,
}: Props) {
  return (

    <div className="space-y-3">
      {/* O4.5(a): bandeja "Aceptadas sin embarque" — el trabajo vendido sin operar. */}
      <Hint label="Cotizaciones aceptadas a las que nadie les abrió el embarque">
        <Button
          type="button"
          variant={soloAceptadasSinEmbarque ? "default" : "outline"}
          size="sm"
          aria-pressed={soloAceptadasSinEmbarque}
          onClick={() => setFilter("aceptadasSinEmbarque", soloAceptadasSinEmbarque ? "no" : "si")}
          className="w-full gap-2"
        >
          <Truck className="h-4 w-4" />
          Aceptadas sin embarque
          {totalAceptadasSinEmbarque > 0 && ` (${totalAceptadasSinEmbarque})`}
        </Button>
      </Hint>
      <Button
        type="button"
        variant={filterSinCostos ? "default" : "outline"}
        size="sm"
        aria-pressed={filterSinCostos}
        onClick={() => setFilter("sinCostos", filterSinCostos ? "no" : "si")}
        className="w-full gap-2"
      >
        <AlertTriangle className="h-4 w-4" />
        Sólo sin costos
      </Button>
      <Hint label="Por defecto se ocultan las cotizaciones Vencidas y Archivadas">
        <Button
          type="button"
          variant={incluirInactivas ? "default" : "outline"}
          size="sm"
          aria-pressed={incluirInactivas}
          onClick={() => setFilter("incluirInactivas", incluirInactivas ? "no" : "si")}
          className="w-full gap-2"
        >
          <Archive className="h-4 w-4" />
          Incluir vencidas/archivadas
        </Button>
      </Hint>
    </div>
    );
}
