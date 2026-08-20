/**
 * OLA B · B.1 — Aviso de comisiones que quedaron en 0 por un fallo de cálculo.
 * Sin esta superficie la cola era invisible y la comisión se perdía en silencio.
 */
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

  if (pendientes.length === 0) return null;

  return (
    <AvisoAccionable
      tono="error"
      icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      titulo={`${pendientes.length} ${pendientes.length === 1 ? "comisión pendiente" : "comisiones pendientes"} de recálculo`}
      descripcion="Estas comisiones quedaron en cero porque faltaban datos al momento del cobro (por ejemplo tipos de cambio o costos del embarque)."
      pasos={[
        "Captura los tipos de cambio del embarque y sus costos.",
        "Vuelve aquí y presiona Reintentar recálculo.",
        "Las comisiones ya liquidadas no se modifican.",
      ]}
      accion={
        <Button size="sm" onClick={() => reprocesar()} disabled={isPending}>
          Reintentar recálculo
        </Button>
      }
    />
  );
}
