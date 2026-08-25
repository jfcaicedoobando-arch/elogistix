/**
 * Encabezado de la sección "Vincular a costos de embarque": título, conteo,
 * botón de sugerencia y resumen de la última sugerencia aplicada.
 * Extraído de `VincularEmbarqueSection` para mantener la complejidad
 * ciclomática dentro del límite del proyecto.
 */
import { Link2, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  totalEmbarques: number;
  puedeSugerir: boolean;
  onSugerir: () => void;
  totalUltimaSugerencia: number;
}

const plural = (n: number) => (n === 1 ? "" : "s");

export function VincularEmbarqueHeader({
  totalEmbarques, puedeSugerir, onSugerir, totalUltimaSugerencia,
}: Props) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Link2 className="h-4 w-4 text-accent" />
        <Label className="text-body font-semibold">Vincular a costos de embarque (opcional)</Label>
        <Badge variant="outline" className="ml-auto text-body-sm">
          {totalEmbarques} embarque{plural(totalEmbarques)} con costos pendientes
        </Badge>
        {puedeSugerir && (
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onSugerir}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Sugerir vinculación
          </Button>
        )}
      </div>
      <p className="text-body-sm text-muted-foreground">
        Marca los conceptos que cubre esta factura, o usa <strong>Sugerir vinculación</strong>{" "}
        para que el sistema los preseleccione por similitud de descripción y monto. Los
        conceptos cubiertos al 100% se marcarán como liquidados automáticamente.
      </p>
      {totalUltimaSugerencia > 0 && (
        <div className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-body-sm text-muted-foreground">
          Última sugerencia: {totalUltimaSugerencia} concepto{plural(totalUltimaSugerencia)}{" "}
          preseleccionado{plural(totalUltimaSugerencia)}. Ajusta lo que no cuadre antes de guardar.
        </div>
      )}
    </>
  );
}
