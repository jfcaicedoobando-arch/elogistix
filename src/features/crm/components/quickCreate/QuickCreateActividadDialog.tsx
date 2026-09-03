/**
 * QuickCreateActividadDialog — alta express de actividad (asunto + fecha).
 * Por default: tarea, hoy 17:00, ligada a una oportunidad.
 *
 * v13.746.0: migrado de Popover a modal estándar (ver nota en
 * `QuickCreateLeadDialog.tsx`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { isValid } from "date-fns";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useCrearActividad, useOportunidades, type CrmEntidadTipo } from "@/features/crm/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  onMore: () => void;
}

function defaultFecha(): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export default function QuickCreateActividadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const crear = useCrearActividad();
  const { data: opsData } = useOportunidades({ pageSize: 100 });
  const [asunto, setAsunto] = useState("");
  const [fecha, setFecha] = useState(defaultFecha());
  const [entidadId, setEntidadId] = useState<string>("");
  const ops = useMemo(() => opsData?.data ?? [], [opsData]);
  // Fecha inicial de ESTA apertura: sirve de referencia para saber si el
  // usuario capturó algo (isDirty) sin considerar el default como captura.
  const [fechaInicial, setFechaInicial] = useState(fecha);
  const abiertoAntes = useRef(open);
  useEffect(() => {
    if (abiertoAntes.current && !open) {
      setAsunto("");
      setEntidadId("");
      const nueva = defaultFecha();
      setFecha(nueva);
      setFechaInicial(nueva);
    }
    abiertoAntes.current = open;
  }, [open]);

  const submit = async () => {
    if (crear.isPending) return;
    const a = asunto.trim();
    if (!a) {
      notifyError(undefined, { title: "Asunto requerido", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_1" });
      return;
    }
    if (!entidadId) {
      notifyError(undefined, { title: "Selecciona una oportunidad", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_2" });
      return;
    }
    // Si el usuario limpia el DateTimePickerMx emite "" — `new Date("")` es
    // Invalid Date y `toISOString()` lanza RangeError. La fecha es opcional.
    const fechaDate = fecha ? new Date(fecha) : null;
    if (fechaDate && !isValid(fechaDate)) {
      notifyError(undefined, { title: "Selecciona una fecha válida", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_4" });
      return;
    }
    try {
      await crear.mutateAsync({
        tipo: "tarea",
        asunto: a,
        descripcion: "",
        entidad_tipo: "oportunidad" as CrmEntidadTipo,
        entidad_id: entidadId,
        fecha_programada: fechaDate ? fechaDate.toISOString() : null,
      });
      notifySuccess(undefined, { title: "Actividad creada", duration: 2000 });
      // El cierre limpia el estado (efecto de transición): sin reset duplicado.
      onOpenChange(false);
      onCreated();
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo crear la actividad", description: getErrorMessage(e),
        error: e,
        method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_3",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Activity}
      title="Nueva actividad"
      description="Queda como tarea pendiente ligada a la oportunidad que elijas."
      size="md"
      formId="qc-actividad-form"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      isDirty={asunto.trim().length > 0 || entidadId.length > 0 || fecha !== fechaInicial}
      busy={crear.isPending}
      footer={
        <FormDialogFooter
          formId="qc-actividad-form"
          onCancel={() => onOpenChange(false)}
          confirmLabel="Crear"
          loading={crear.isPending}
          extra={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onMore}
              disabled={crear.isPending}
              className="text-body-sm"
            >
              Más campos →
            </Button>
          }
        />
      }
    >
      <FormDialogSection flat>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="qc-actividad-asunto">Asunto *</Label>
            <Input
              id="qc-actividad-asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Llamar a cliente"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qc-actividad-oportunidad">Oportunidad *</Label>
            <Select value={entidadId || undefined} onValueChange={setEntidadId}>
              <SelectTrigger id="qc-actividad-oportunidad"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {ops.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>))}
                {ops.length === 0 && <div className="p-2 text-body-sm text-muted-foreground">Sin oportunidades</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fecha</Label>
            <DateTimePickerMx value={fecha} onChange={setFecha} />
          </div>
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
