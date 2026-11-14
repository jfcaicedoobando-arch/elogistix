/** Editar % del broker y % del KAM en las cuentas de ese broker. */
import { useState } from "react";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import type { BrokerFila } from "@/features/admin/services/brokers";
import { useSetPorcentajesBroker } from "@/features/admin/hooks/useBrokerComisiones";

const okPct = (v: string) => v !== "" && Number(v) >= 0 && Number(v) <= 100;

export default function PorcentajesBrokerDialog({ broker, onClose }: { broker: BrokerFila; onClose: () => void }) {
  const [b, setB] = useState(String(broker.comision_pct));
  const [k, setK] = useState(broker.comision_kam_pct == null ? "" : String(broker.comision_kam_pct));
  const m = useSetPorcentajesBroker();
  const valido = okPct(b) && (k === "" || okPct(k));
  const guardar = async () => {
    if (!valido) return;
    try {
      await m.mutateAsync({ id: broker.id, broker: Number(b), kam: k === "" ? null : Number(k) });
      onClose();
    } catch {
      // el aviso lo muestra el hook
    }
  };
  const total = Number(b || 0) + Number(k || 0);
  return (
    <FormDialogShell open onOpenChange={(o) => { if (!o) onClose(); }} icon={Percent}
      title={`Comisión de ${broker.nombre}`} description="Aplica sólo a cobros nuevos de clientes que trajo este broker."
      size="md" isDirty busy={m.isPending}
      footer={<>
        <Button type="button" variant="outline" onClick={onClose} disabled={m.isPending}>Cancelar</Button>
        <Button onClick={guardar} disabled={!valido} loading={m.isPending}>Guardar</Button>
      </>}>
      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label htmlFor="pct-broker">% del broker</Label>
          <Input id="pct-broker" type="number" min={0} max={100} step="0.01" value={b} onChange={(e) => setB(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pct-kam">% del KAM en estas cuentas</Label>
          <Input id="pct-kam" type="number" min={0} max={100} step="0.01" value={k} onChange={(e) => setK(e.target.value)} placeholder="Vacío = su % normal" />
        </div>
        <p className="text-body-sm text-muted-foreground">
          {k === "" ? "El KAM conserva su % normal." : `Comisión total: ${total}% de la utilidad real cobrada.`}
        </p>
      </FormDialogSection>
    </FormDialogShell>
  );
}
