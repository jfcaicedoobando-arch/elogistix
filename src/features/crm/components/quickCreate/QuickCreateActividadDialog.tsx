/**
 * QuickCreateActividadDialog — alta express de actividad (asunto + fecha).
 * Por default: tarea, hoy 17:00, ligada a una oportunidad.
 *
 * v13.746.0: migrado de Popover a modal estándar (ver nota en
 * `QuickCreateLeadDialog.tsx`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { notifyError } from "@/lib/ui/appFeedback";
import { useCrearActividad, useOportunidades, type CrmEntidadTipo } from "@/features/crm/hooks";
import { actividadDefaultFechaMx } from "@/features/crm/domain/actividadDefaultFecha";
import { mxLocalToUtcIso } from "@/lib/date/mx";

/** Borrador mínimo que viaja de la alta express al formulario completo. */
export interface ActividadQuickDraft {
  asunto: string;
  entidadId: string;
  tipo: "tarea";
  fecha: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  onMore: (draft: ActividadQuickDraft) => void;
}

// Hallazgo #13.2: default con calendario de negocio CDMX (no nace vencida).
function defaultFecha(): string {
  return actividadDefaultFechaMx();
}

export default function QuickCreateActividadDialog({ open, onOpenChange, onCreated, onMore }: Props) {
  const crear = useCrearActividad();
  const enviandoRef = useRef(false);
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
    } else if (!abiertoAntes.current && open) {
      // Al abrir: si el usuario no capturó fecha (sigue en el default de la
      // apertura anterior), refrescar el default por si cambió el día.
      setFecha((actual) => {
        if (actual !== fechaInicial) return actual;
        const nueva = defaultFecha();
        setFechaInicial(nueva);
        return nueva;
      });
    }
    abiertoAntes.current = open;
  }, [open, fechaInicial]);


  const submit = async () => {
    if (crear.isPending || enviandoRef.current) return;
    const a = asunto.trim();
    if (!a) {
      notifyError(undefined, { title: "Asunto requerido", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_1" });
      return;
    }
    if (!entidadId) {
      notifyError(undefined, { title: "Selecciona una oportunidad", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_2" });
      return;
    }
    // El picker emite hora CDMX; `mxLocalToUtcIso` la convierte a UTC y
    // devuelve null si viene vacía o mal formada. La fecha es opcional.
    const fechaUtc = mxLocalToUtcIso(fecha);
    if (fecha.trim() && !fechaUtc) {
      notifyError(undefined, { title: "Selecciona una fecha válida", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADDIALOG_4" });
      return;
    }
    enviandoRef.current = true;
    try {
      await crear.mutateAsync({
        tipo: "tarea",
        asunto: a,
        descripcion: "",
        entidad_tipo: "oportunidad" as CrmEntidadTipo,
        entidad_id: entidadId,
        fecha_programada: fechaUtc,
      });
      // Hallazgo #13.1: el toast de éxito lo emite `useCrearActividad`; aquí
      // sólo se cierra el diálogo (sin duplicar la notificación).
      onOpenChange(false);
      onCreated();
    } catch {
      // El toast de error ya lo emitió `useCrearActividad`.
    } finally {
      enviandoRef.current = false;
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
              onClick={() => onMore({ asunto: asunto.trim(), entidadId, tipo: "tarea", fecha })}
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
