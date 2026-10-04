/** Distingue ausencia de embarque de los fallos de cálculo recuperables. */
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvisoAccionable } from "@/components/shared/states/AvisoAccionable";
import {
  useComisionesPendientes,
  useReprocesarComisionesPendientes,
} from "@/features/comisiones/hooks/useComisionesPendientes";

export function AlertaComisionesPendientes() {
  const { data: pendientes = [] } = useComisionesPendientes();
  const { mutate: reprocesar, isPending } = useReprocesarComisionesPendientes();
  const sinEmbarque = pendientes.filter((p) => p.etapa === "consolidada_sin_embarque");
  const recalculables = pendientes.filter((p) => p.etapa !== "consolidada_sin_embarque");

  if (pendientes.length === 0) return null;

  return <div className="space-y-4">
    {sinEmbarque.length > 0 && <AvisoAccionable
      tono="neutral"
      icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      titulo={`${sinEmbarque.length} ${sinEmbarque.length === 1 ? "cobro sin embarque asociado" : "cobros sin embarque asociado"}`}
      descripcion="La comisión no está calculada porque estas facturas no tienen un embarque asociado. Esto no significa que el cobro sea cero ni que exista una comisión por pagar."
      pasos={[
        "Revisa la factura con Administración para determinar si corresponde asociarla a un embarque y qué regla de comisión aplica.",
        "Reintentar el cálculo no resuelve la ausencia de embarque.",
      ]}
    />}
    {recalculables.length > 0 && <AvisoAccionable
      tono="error"
      icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      titulo={`${recalculables.length} ${recalculables.length === 1 ? "comisión pendiente" : "comisiones pendientes"} de recálculo`}
      descripcion="El cálculo no pudo completarse. Revisa los motivos registrados antes de reintentarlo."
      pasos={[
        ...new Set(recalculables.map((p) => p.motivo)),
        "Vuelve aquí y presiona Reintentar recálculo.",
        "Las comisiones ya liquidadas no se modifican.",
      ]}
      accion={
        <Button size="sm" onClick={() => reprocesar()} disabled={isPending}>
          Reintentar recálculo
        </Button>
      }
    />}
  </div>;
}
