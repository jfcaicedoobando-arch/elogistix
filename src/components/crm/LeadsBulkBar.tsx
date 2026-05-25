/**
 * Barra contextual de acciones bulk para leads seleccionados.
 */
import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import VendedorSelect from "@/components/crm/VendedorSelect";
import {
  LEAD_ESTADOS, useActualizarLeadsBulk, useEliminarLeadsBulk, type CrmLeadEstado,
} from "@/hooks/crm/useLeads";

interface Props {
  ids: string[];
  onClear: () => void;
  onDone: () => void;
}

export default function LeadsBulkBar({ ids, onClear, onDone }: Props) {
  const { toast } = useToast();
  const actualizar = useActualizarLeadsBulk();
  const eliminar = useEliminarLeadsBulk();
  const [delOpen, setDelOpen] = useState(false);

  const handleEstado = async (estado: CrmLeadEstado) => {
    try {
      const { updated } = await actualizar.mutateAsync({ ids, patch: { estado } });
      notifySuccess(toast, { title: `${updated} leads actualizados`, description: `Estado: ${estado}` });
      onDone();
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleVendedor = async (vendedor_id: string | null, vendedor_email: string) => {
    try {
      const { updated } = await actualizar.mutateAsync({
        ids,
        patch: { vendedor_id, vendedor_email },
      });
      notifySuccess(toast, { title: `${updated} leads reasignados` });
      onDone();
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleEliminar = async () => {
    try {
      const { deleted } = await eliminar.mutateAsync(ids);
      notifySuccess(toast, { title: `${deleted} leads eliminados` });
      onDone();
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
    }
  };

  if (ids.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-primary text-primary-foreground rounded-md shadow-lg p-3 flex flex-wrap items-center gap-3">
      <span className="font-medium text-sm">{ids.length} seleccionado{ids.length === 1 ? "" : "s"}</span>

      <Select onValueChange={(v) => handleEstado(v as CrmLeadEstado)}>
        <SelectTrigger className="h-8 w-[170px] bg-background text-foreground">
          <SelectValue placeholder="Cambiar estado..." />
        </SelectTrigger>
        <SelectContent>
          {LEAD_ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="bg-background text-foreground rounded px-2 py-1 min-w-[220px]">
        <VendedorSelect value={null} onChange={handleVendedor} label="" />
      </div>

      <Button size="sm" variant="destructive" onClick={() => setDelOpen(true)} disabled={eliminar.isPending}>
        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
      </Button>
      <Button size="sm" variant="secondary" onClick={onClear} className="ml-auto">
        <X className="h-4 w-4 mr-1" /> Cancelar
      </Button>

      <DoubleConfirmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        entityName={`${ids.length} leads`}
        onConfirm={handleEliminar}
        isPending={eliminar.isPending}
      />
    </div>
  );
}
