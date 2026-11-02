import { Badge } from "@/components/ui/badge";
import { NOTA_EDITADA_A_MANO } from "@/features/cotizacion/domain/costosAutoGenerados";

/** Expone la marca existente de una precarga editada, sin abrir sus notas. */
export function EstadoFilaCostoManual({ notas }: { notas?: string }) {
  if (!notas?.trim().startsWith(`${NOTA_EDITADA_A_MANO} — `)) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-label">
      <Badge variant="secondary">Manual · conserva tus cambios</Badge>
      <span className="text-muted-foreground">
        Esta fila ya no se recalcula desde la tarifa o el flete del Paso 1.
      </span>
    </div>
  );
}
