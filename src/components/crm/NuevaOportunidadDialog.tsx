/**
 * Diálogo para crear / editar una Oportunidad CRM.
 * Form fields en `nuevaOportunidad/OportunidadFormFields`; estado en `useOportunidadForm`.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/shared";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCrearOportunidad,
  useActualizarOportunidad,
  type CrmOportunidadRow,
} from "@/hooks/crm";
import { useEtapasPipeline } from "@/hooks/crm";
import { useClientesForSelect } from "@/hooks/cliente";
import { useCrearActividad } from "@/hooks/crm";
import { useOportunidadForm } from "@/hooks/crm";
import OportunidadFormFields from "@/components/crm/nuevaOportunidad/OportunidadFormFields";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidad?: CrmOportunidadRow | null;
  onSaved?: (id: string) => void;
}

export default function NuevaOportunidadDialog({ open, onOpenChange, oportunidad, onSaved }: Props) {
  const isEdit = !!oportunidad;
  const { user } = useAuth();
  const { data: etapas = [] } = useEtapasPipeline();
  const { data: clientes = [] } = useClientesForSelect() as { data: { id: string; nombre: string }[] | undefined };
  const crear = useCrearOportunidad();
  const actualizar = useActualizarOportunidad();
  const crearActividad = useCrearActividad();
  const { toast } = useToast();

  const { form, setForm, set } = useOportunidadForm(open, oportunidad, etapas, user);
  const [autoActividad, setAutoActividad] = useState(true);

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return notifyError(toast, { title: "Nombre es obligatorio" });
    if (!form.etapa_id) return notifyError(toast, { title: "Selecciona una etapa" });
    try {
      const payload = {
        nombre: form.nombre,
        cliente_id: form.cliente_id,
        cliente_nombre: form.cliente_nombre,
        etapa_id: form.etapa_id,
        monto_estimado: form.monto_estimado,
        moneda: form.moneda,
        probabilidad: form.probabilidad,
        fecha_estimada_cierre: form.fecha_estimada_cierre || null,
        modo: form.modo,
        origen: form.origen,
        destino: form.destino,
        notas: form.notas,
        vendedor_id: form.vendedor_id,
        vendedor_email: form.vendedor_email,
      };
      if (isEdit && oportunidad) {
        await actualizar.mutateAsync({ id: oportunidad.id, patch: payload });
        notifySuccess(toast, { title: "Oportunidad actualizada" });
        onSaved?.(oportunidad.id);
      } else {
        const r = await crear.mutateAsync(payload);
        if (autoActividad) {
          const manana = new Date();
          manana.setDate(manana.getDate() + 1);
          manana.setHours(9, 0, 0, 0);
          await crearActividad.mutateAsync({
            tipo: "tarea",
            asunto: `Preparar propuesta: ${form.nombre}`,
            descripcion: "Actividad creada automáticamente al alta de la oportunidad.",
            entidad_tipo: "oportunidad",
            entidad_id: r.id,
            fecha_programada: manana.toISOString(),
          }).catch(() => undefined);
        }
        notifySuccess(toast, { title: "Oportunidad creada" });
        onSaved?.(r.id);
      }
      onOpenChange(false);
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const pending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle>
          <DialogDescription>Captura los datos comerciales y la etapa del pipeline.</DialogDescription>
        </DialogHeader>

        <OportunidadFormFields
          form={form}
          setForm={setForm}
          set={set}
          etapas={etapas}
          clientes={clientes}
          isEdit={isEdit}
          autoActividad={autoActividad}
          setAutoActividad={setAutoActividad}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear oportunidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
