/**
 * Alerta inline mostrada en el tab Facturación cuando se detecta un borrador
 * de proforma vacío (sin conceptos / total cero) en el mismo embarque donde
 * existen conceptos de venta pendientes sin asignar. Permite asignar los
 * conceptos pendientes al borrador o eliminarlo.
 */
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ProformaConFactura } from "@/features/proformas/services";
import type { Tables } from "@/types/db";
import { useAsignarConceptosProforma } from "@/features/embarques/hooks/useAsignarConceptosProforma";

interface Props {
  proformaBorrador: ProformaConFactura;
  conceptosPendientes: Tables<"conceptos_venta">[];
  embarqueId: string;
  onEliminarBorrador: () => void;
}

export function ProformaInconsistenteAlert({
  proformaBorrador,
  conceptosPendientes,
  embarqueId,
  onEliminarBorrador,
}: Props) {
  const conceptoIds = useMemo(
    () => conceptosPendientes.map((c) => c.id),
    [conceptosPendientes],
  );

  const asignar = useAsignarConceptosProforma({
    proformaId: proformaBorrador.id,
    proformaNumero: proformaBorrador.numero,
    embarqueId,
    conceptoIds,
  });


  if (conceptosPendientes.length === 0) return null;
  const n = conceptosPendientes.length;

  return (
    <Alert className="border-warning/40 bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">
        Proforma {proformaBorrador.numero} está vacía
      </AlertTitle>
      <AlertDescription className="text-warning/90">
        <p className="mb-3">
          Hay {n} concepto{n !== 1 ? "s" : ""} de venta pendiente{n !== 1 ? "s" : ""} sin
          asignar y este borrador no tiene conceptos. Asígnalos a esta proforma o
          elimínala para crear una nueva.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="default"
            disabled={asignar.isPending}
            onClick={() => asignar.mutate()}
          >
            {asignar.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Asignando…</>
            ) : (
              <>Asignar {n} concepto{n !== 1 ? "s" : ""} a esta proforma</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onEliminarBorrador} disabled={asignar.isPending}>
            Eliminar borrador
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
