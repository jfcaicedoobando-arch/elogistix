/**
 * QuickCreateActividadPopover — alta express de actividad (asunto + fecha).
 * Por default: tarea, hoy 17:00, entidad oportunidad si hay contexto.
 */
import { useState, useMemo } from "react";
import { isValid } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useCrearActividad, useOportunidades, type CrmEntidadTipo } from "@/features/crm/hooks";

import { notifyError } from "@/lib/ui/appFeedback";
import { SectionHeading } from "@/components/shared/SectionHeading";
interface Props {
  onCreated: () => void;
  onMore: () => void;
  onClose: () => void;
}

function defaultFecha(): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export default function QuickCreateActividadPopover({ onCreated, onMore, onClose }: Props) {
  const crear = useCrearActividad();
  const { data: opsData } = useOportunidades({ pageSize: 100 });
  const [asunto, setAsunto] = useState("");
  const [fecha, setFecha] = useState(defaultFecha());
  const [entidadId, setEntidadId] = useState<string>("");
  const ops = useMemo(() => opsData?.data ?? [], [opsData]);

  const submit = async () => {
    const a = asunto.trim();
    if (!a) return notifyError(undefined, { title: "Asunto requerido", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADPOPOVER_1" });
    if (!entidadId) return notifyError(undefined, { title: "Selecciona una oportunidad", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADPOPOVER_2" });
    // Si el usuario limpia el DateTimePickerMx emite "" — `new Date("")` es
    // Invalid Date y `toISOString()` lanza RangeError ("Invalid time value").
    // Como en NuevaActividadDialog, la fecha es opcional: vacía → null; un
    // valor no parseable se valida con un mensaje claro en vez del RangeError.
    const fechaDate = fecha ? new Date(fecha) : null;
    if (fechaDate && !isValid(fechaDate)) {
      return notifyError(undefined, { title: "Selecciona una fecha válida", method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADPOPOVER_4" });
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
      setAsunto("");
      onClose();
      onCreated();
    } catch (e) {
      notifyError(undefined, { title: e instanceof Error ? e.message : "Error al crear", error: e, method: "FEATURES_CRM_COMPONENTS_QUICKCREATE_QUICKCREATEACTIVIDADPOPOVER_3" });
    }
  };

  return (
    <div className="space-y-3 w-80">
      <SectionHeading as="h3">Nueva actividad</SectionHeading>
      <div className="space-y-1">
        <Label htmlFor="qc-actividad-asunto">Asunto *</Label>
        <Input id="qc-actividad-asunto" autoFocus value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Llamar a cliente" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      </div>
      <div className="space-y-1">
        <Label>Oportunidad *</Label>
        <Select value={entidadId || undefined} onValueChange={setEntidadId}>
          <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
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
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onMore} className="text-body-sm">Más campos →</Button>
        <Button size="sm" onClick={submit} loading={crear.isPending}>
          Crear
        </Button>
      </div>
    </div>
  );
}
