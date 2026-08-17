/**
 * Diálogos secundarios de la vista de Oportunidades: próximo paso tras mover
 * una tarjeta y motivo de pérdida obligatorio al cerrar como perdida.
 */
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";
import { DialogMotivoPerdida } from "@/features/crm/components/DialogMotivoPerdida";
import type {
  ProximoPasoTarget,
  PerdidaPendiente,
} from "@/features/crm/hooks/useMoverOportunidadEtapa";

interface Props {
  proximoPaso: ProximoPasoTarget | null;
  cerrarProximoPaso: () => void;
  perdidaPendiente: PerdidaPendiente | null;
  cerrarPerdida: () => void;
  confirmarPerdida: (motivoPerdidaId: string) => void;
  moviendo: boolean;
}

export default function OportunidadesDialogs({
  proximoPaso, cerrarProximoPaso, perdidaPendiente, cerrarPerdida, confirmarPerdida, moviendo,
}: Props) {
  return (
    <>
      {/* Disciplina de pipeline: próximo paso tras mover a una etapa abierta. */}
      <NuevaActividadDialog
        open={proximoPaso != null}
        onOpenChange={(o) => { if (!o) cerrarProximoPaso(); }}
        defaultEntidad={
          proximoPaso
            ? { tipo: "oportunidad", id: proximoPaso.id, label: proximoPaso.nombre }
            : undefined
        }
        onCreated={cerrarProximoPaso}
      />

      {/* Ola A: motivo de pérdida obligatorio al cerrar como perdida. */}
      <DialogMotivoPerdida
        open={perdidaPendiente != null}
        onOpenChange={(o) => { if (!o) cerrarPerdida(); }}
        oportunidadNombre={perdidaPendiente?.nombre ?? ""}
        loading={moviendo}
        onConfirm={({ motivo_perdida_id }) => confirmarPerdida(motivo_perdida_id)}
      />
    </>
  );
}
