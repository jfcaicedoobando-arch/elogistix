/**
 * Diálogo obligatorio de motivo de pérdida (v13.630.0 — Ola A CRM).
 *
 * Se abre al mover una oportunidad a una etapa de tipo "perdida" (Kanban,
 * listado o detalle). Sin motivo no se puede continuar: la base también lo
 * rechaza con `LC_MOTIVO_PERDIDA_REQUERIDO`.
 */
import { useEffect, useState } from "react";
import { TrendingDown } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMotivosPerdida } from "@/features/crm/hooks";

export interface MotivoPerdidaResultado {
  motivo_perdida_id: string;
  nota: string;
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
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!open) {
      setMotivoId("");
      setNota("");
    }
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
          onConfirm={() => onConfirm({ motivo_perdida_id: motivoId, nota: nota.trim() })}
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
        <div className="space-y-1.5">
          <Label htmlFor="motivo-nota">Detalle (opcional)</Label>
          <Textarea
            id="motivo-nota"
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Contra quién se perdió, precio ofertado, aprendizaje…"
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
