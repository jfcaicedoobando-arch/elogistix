import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useGenerarLiquidacion } from "@/features/comisiones/hooks";

interface VendedoraOpt { id: string; nombre: string }

export function DialogGenerarLiquidacion({
  open, onOpenChange, vendedoras,
}: { open: boolean; onOpenChange: (o: boolean) => void; vendedoras: VendedoraOpt[] }) {
  const { organizationId } = useOrganization();
  const [vendedoraId, setVendedoraId] = useState("");
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const gen = useGenerarLiquidacion();

  // 13.85.10 — Toasts viven en `useGenerarLiquidacion`. Aquí sólo cerramos el dialog.
  const submit = () => {
    if (!vendedoraId || !periodo || !organizationId) return;
    gen.mutate(
      { vendedora_id: vendedoraId, periodo, organization_id: organizationId },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Wallet}
      title="Generar liquidación de comisiones"
      description="Genera la liquidación de comisiones para los agentes en el período indicado."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!vendedoraId || gen.isPending}>
            {gen.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Generar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Vendedora</Label>
          <Select value={vendedoraId} onValueChange={setVendedoraId}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {vendedoras.map((v) => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Periodo</Label>
          <MonthPickerMx value={periodo} onChange={setPeriodo} />
        </div>
      </div>
    </FormDialogShell>
  );
}
