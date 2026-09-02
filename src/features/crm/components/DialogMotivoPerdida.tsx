/**
 * Diálogo obligatorio de motivo de pérdida (v13.630.0 — Ola A CRM).
 *
 * Se abre al mover una oportunidad a una etapa de tipo "perdida" (Kanban,
 * listado o detalle). Sin motivo no se puede continuar: la base también lo
 * rechaza con `LC_MOTIVO_PERDIDA_REQUERIDO`.
 *
 * v13.823.50 — se retiró el campo "Detalle (opcional)": nunca se guardaba en
 * ninguna columna (el confirm sólo usa `motivo_perdida_id`), así que la UI
 * fingía persistir la nota del usuario.
 */
import { useEffect, useState } from "react";
import { TrendingDown } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMotivosPerdida } from "@/features/crm/hooks";

export interface MotivoPerdidaResultado {
  motivo_perdida_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre de la oportunidad que se está cerrando. */
  oportunidadNombre: string;
  loading?: boolean;
  onConfirm: (r: MotivoPerdidaResultado) => void | Promise<void>;
}

export function DialogMotivoPerdida({
  open, onOpenChange, oportunidadNombre, loading = false, onConfirm,
}: Props) {
  const { data: motivos = [] } = useMotivosPerdida(true);
  const [motivoId, setMotivoId] = useState("");

  useEffect(() => {
    if (!open) setMotivoId("");
  }, [open]);

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={TrendingDown}
      title="¿Por qué se perdió?"
      description={`Registra el motivo para cerrar "${oportunidadNombre}". Sin motivo no se puede marcar como perdida.`}
      size="md"
      footer={
        <FormDialogFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={() => onConfirm({ motivo_perdida_id: motivoId })}
          confirmLabel="Marcar como perdida"
          loading={loading}
          disabled={!motivoId}
        />
      }
    >
      <FormDialogSection title="Motivo">
        <div className="space-y-1.5">
          <Label htmlFor="motivo-perdida">Motivo de pérdida *</Label>
          <Select value={motivoId} onValueChange={setMotivoId}>
            <SelectTrigger id="motivo-perdida">
              <SelectValue placeholder="Selecciona un motivo" />
            </SelectTrigger>
            <SelectContent>
              {motivos.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {motivos.length === 0 && (
            <EmptyStateInline
              icon={TrendingDown}
              message="No hay motivos activos. Agrégalos en Configuración del CRM."
              className="py-3"
            />
          )}
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
