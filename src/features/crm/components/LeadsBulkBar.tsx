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
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import VendedorSelect from "@/features/crm/components/VendedorSelect";
import {
  LEAD_ESTADOS_MANUALES, useActualizarLeadsBulk, useEliminarLeadsBulk, type CrmLeadEstado,
} from "@/features/crm/hooks";

interface Props {
  ids: string[];
  onClear: () => void;
  onDone: () => void;
}

export default function LeadsBulkBar({ ids, onClear, onDone }: Props) {
  const actualizar = useActualizarLeadsBulk();
  const eliminar = useEliminarLeadsBulk();
  const [delOpen, setDelOpen] = useState(false);

  const handleEstado = async (estado: CrmLeadEstado) => {
    try {
      const { updated } = await actualizar.mutateAsync({ ids, patch: { estado } });
      crmToast.success(`${updated} leads → ${estado}`);
      onDone();
    } catch (e) {
      notifyError(undefined, { title: "Error", description: e instanceof Error ? e.message : undefined, error: e, method: "HANDLE_ESTADO" });
    }
  };

  const handleVendedor = async (vendedor_id: string | null, vendedor_email: string) => {
    try {
      const { updated } = await actualizar.mutateAsync({
        ids,
        patch: { vendedor_id, vendedor_email },
      });
      crmToast.success(`${updated} leads reasignados`);
      onDone();
    } catch (e) {
      notifyError(undefined, { title: "Error", description: e instanceof Error ? e.message : undefined, error: e, method: "HANDLE_VENDEDOR" });
    }
  };

  const handleEliminar = async () => {
    try {
      const { deleted } = await eliminar.mutateAsync(ids);
      crmToast.success(`${deleted} leads eliminados`);
      onDone();
    } catch (e) {
      notifyError(undefined, { title: "Error", description: e instanceof Error ? e.message : undefined, error: e, method: "HANDLE_ELIMINAR" });
    }
  };

  if (ids.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-primary text-primary-foreground rounded-lg shadow-raised p-3 flex flex-wrap items-center gap-3">
      <span className="font-medium text-body">{ids.length} seleccionado{ids.length === 1 ? "" : "s"}</span>

      <Select onValueChange={(v) => handleEstado(v as CrmLeadEstado)}>
        <SelectTrigger className="h-8 w-[170px] bg-background text-foreground">
          <SelectValue placeholder="Cambiar estado…" />
        </SelectTrigger>
        <SelectContent>
          {/* v13.823.62: el cambio masivo sólo alcanza estados manuales. */}
          {LEAD_ESTADOS_MANUALES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
