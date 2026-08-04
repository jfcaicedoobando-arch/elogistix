/**
 * FIX 9.3 — Aviso visible cuando `parseConceptosDetallado` descartó filas
 * irrecuperables de `conceptos_venta`. Antes se descartaban en silencio y el
 * total podía mostrarse incompleto sin ninguna señal para el usuario.
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { pluralizar } from "@/lib/format/pluralizar";

interface AvisoConceptosDescartadosProps {
  /** Cantidad de filas de `conceptos_venta` que no se pudieron parsear. */
  descartados: number;
  /** Cantidad de conceptos válidos que sí se lograron parsear. */
  conceptosValidos: number;
}

/** No renderiza nada si no hubo descartes. */
export function AvisoConceptosDescartados({ descartados, conceptosValidos }: AvisoConceptosDescartadosProps) {
  if (descartados <= 0) return null;
  const todosDescartados = conceptosValidos === 0;

  return (
    <Alert variant={todosDescartados ? "destructive" : "warning"}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {pluralizar(descartados, "concepto", { plural: "conceptos" })} no se pudo mostrar
      </AlertTitle>
      <AlertDescription>
        {pluralizar(descartados, "concepto", { plural: "conceptos" })} no se{" "}
        {descartados === 1 ? "pudo mostrar" : "pudieron mostrar"} por datos incompletos.
        {todosDescartados
          ? " No hay conceptos válidos para calcular el total."
          : " El total puede estar incompleto."}
      </AlertDescription>
    </Alert>
  );
}
