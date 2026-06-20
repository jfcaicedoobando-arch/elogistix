import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generar liquidación de comisiones</DialogTitle><DialogDescription>Genera la liquidación de comisiones para los agentes en el período indicado.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
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
            <Label>Periodo (YYYY-MM)</Label>
            <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!vendedoraId || gen.isPending}>
            {gen.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
