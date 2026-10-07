/**
 * Cambiar de etapa desde el detalle de la oportunidad. Reusa el mismo flujo
 * del Kanban (probabilidad, cierre, motivo de pérdida, próximo paso, Undo).
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMoverOportunidadEtapa } from "@/features/crm/hooks/useMoverOportunidadEtapa";
import OportunidadesDialogs from "@/features/crm/components/OportunidadesDialogs";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

interface Props {
  op: CrmOportunidadRow;
  etapas: CrmEtapaRow[];
}

export function MoverEtapaSelect({ op, etapas }: Props) {
  const m = useMoverOportunidadEtapa({ etapas, oportunidades: [op] });
  const onChange = (etapaId: string) => {
    if (etapaId === op.etapa_id) return;
    const destino = etapas.find((e) => e.id === etapaId);
    void m.handleMover(op.id, etapaId, Number(destino?.probabilidad_default ?? 0));
  };
  return (
    <>
      <Select value={op.etapa_id} onValueChange={onChange} disabled={m.moviendo}>
        <SelectTrigger className="h-9 w-[200px]" aria-label="Mover a etapa">
          <SelectValue placeholder="Mover a etapa" />
        </SelectTrigger>
        <SelectContent>
          {etapas.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <OportunidadesDialogs
        proximoPaso={m.proximoPaso}
        cerrarProximoPaso={m.cerrarProximoPaso}
        perdidaPendiente={m.perdidaPendiente}
        cerrarPerdida={m.cerrarPerdida}
        confirmarPerdida={(id) => void m.confirmarPerdida(id)}
        moviendo={m.moviendo}
      />
    </>
  );
}
