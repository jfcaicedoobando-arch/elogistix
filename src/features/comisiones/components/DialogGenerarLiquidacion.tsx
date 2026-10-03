import { useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MonthPickerMx } from "@/components/ui/month-picker-mx";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useGenerarLiquidacion } from "@/features/comisiones/hooks";
import { ymMx } from "@/lib/date/mx";
import type { UsuarioVendedor } from "../services/vendedoras";
import { etiquetaVendedora } from "../services/vendedorasIdentidad";
import { Alert, AlertDescription } from "@/components/ui/alert";

type VendedoraOpt = UsuarioVendedor;

export function DialogGenerarLiquidacion({
  open, onOpenChange, vendedoras,
}: { open: boolean; onOpenChange: (o: boolean) => void; vendedoras: VendedoraOpt[] }) {
  const { organizationId } = useOrganization();
  const [vendedoraId, setVendedoraId] = useState("");
  const [periodo, setPeriodo] = useState(ymMx());
  const gen = useGenerarLiquidacion();
  const seleccionada = vendedoras.find((v) => v.id === vendedoraId);
  const puedeGenerar = Boolean(seleccionada?.identidadResuelta && periodo && organizationId);

  // 13.85.10 — Toasts viven en `useGenerarLiquidacion`. Aquí sólo cerramos el dialog.
  const submit = () => {
    if (!puedeGenerar || !organizationId) return;
    gen.mutate(
      { vendedora_id: vendedoraId, periodo, organization_id: organizationId },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Banknote}
      title="Generar liquidación de comisiones"
      description="Genera la liquidación de comisiones para los agentes en el período indicado."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!puedeGenerar} loading={gen.isPending}>
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
              {vendedoras.map((v) => <SelectItem key={v.id} value={v.id} disabled={!v.identidadResuelta}>{etiquetaVendedora(v)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {vendedoras.some((v) => !v.identidadResuelta) && (
          <Alert variant="warning"><AlertDescription>
            Hay vendedoras sin una identidad distinguible. Completa su nombre o consulta el directorio antes de generar una liquidación.
          </AlertDescription></Alert>
        )}
        <div className="space-y-1">
          <Label>Periodo</Label>
          <MonthPickerMx value={periodo} onChange={setPeriodo} />
        </div>
      </div>
    </FormDialogShell>
  );
}
