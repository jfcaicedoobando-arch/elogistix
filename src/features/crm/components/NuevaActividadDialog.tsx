/**
 * NuevaActividadDialog — alta rápida de actividad para Lead u Oportunidad.
 * Usado por QuickAddMenu y por cualquier flujo que necesite crear una tarea.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useState, useMemo } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import {
  ACTIVIDAD_TIPOS, useCrearActividad,
  type CrmActividadTipo, type CrmEntidadTipo,
} from "@/features/crm/hooks";
import { useLeads } from "@/features/crm/hooks";
import { useOportunidades } from "@/features/crm/hooks";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntidad?: { tipo: CrmEntidadTipo; id: string; label?: string };
  onCreated?: (id: string) => void;
}

export default function NuevaActividadDialog({ open, onOpenChange, defaultEntidad, onCreated }: Props) {
  const crear = useCrearActividad();
  const [entidadTipo, setEntidadTipo] = useState<CrmEntidadTipo>(defaultEntidad?.tipo ?? "oportunidad");
  const [entidadId, setEntidadId] = useState<string>(defaultEntidad?.id ?? "");
  const [tipo, setTipo] = useState<CrmActividadTipo>("tarea");
  const [asunto, setAsunto] = useState("");
  const [desc, setDesc] = useState("");
  const [fecha, setFecha] = useState("");

  const { data: leadsData } = useLeads({ pageSize: 100 });
  const { data: opsData } = useOportunidades({ pageSize: 200 });

  const opciones = useMemo(() => {
    if (entidadTipo === "lead") {
      return (leadsData?.data ?? []).map((l) => ({ id: l.id, label: l.empresa }));
    }
    if (entidadTipo === "oportunidad") {
      return (opsData?.data ?? []).map((o) => ({ id: o.id, label: o.nombre }));
    }
    return [];
  }, [entidadTipo, leadsData, opsData]);

  const reset = () => {
    setAsunto(""); setDesc(""); setFecha("");
    if (!defaultEntidad) { setEntidadId(""); setEntidadTipo("oportunidad"); }
  };

  const handleSubmit = async () => {
    if (!entidadId) return notifyError(undefined, { title: "Selecciona la entidad", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
    if (!asunto.trim()) return notifyError(undefined, { title: "Asunto requerido", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
    try {
      const res = await crear.mutateAsync({
        tipo,
        asunto: asunto.trim(),
        descripcion: desc.trim(),
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        fecha_programada: fecha ? new Date(fecha).toISOString() : null,
      });
      crmToast.success("Actividad creada");
      reset();
      onOpenChange(false);
      onCreated?.(res.id);
    } catch (e) {
      notifyError(undefined, { title: "No se pudo crear", description: e instanceof Error ? e.message : undefined, error: e, method: "HANDLE_SUBMIT" });
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={handleSubmit} disabled={crear.isPending}>
        {crear.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Crear
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ClipboardList}
      title="Nueva actividad"
      description="Registra una tarea, llamada, reunión o nota."
      size="md"
      footer={footer}
    >
      {!defaultEntidad && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tipo de entidad</Label>
            <Select value={entidadTipo} onValueChange={(v) => { setEntidadTipo(v as CrmEntidadTipo); setEntidadId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="oportunidad">Oportunidad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{entidadTipo === "lead" ? "Lead" : "Oportunidad"}</Label>
            <Select value={entidadId || undefined} onValueChange={setEntidadId}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {opciones.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
                {opciones.length === 0 && <div className="p-2 text-xs text-muted-foreground">Sin registros</div>}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {defaultEntidad?.label && (
        <div className="text-xs text-muted-foreground">Para: <span className="font-medium text-foreground">{defaultEntidad.label}</span></div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as CrmActividadTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVIDAD_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Fecha programada</Label>
          <DateTimePickerMx value={fecha} onChange={setFecha} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Asunto</Label>
        <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Llamar a cliente, enviar cotización…" />
      </div>
      <div className="space-y-1">
        <Label>Descripción</Label>
        <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
    </FormDialogShell>
  );
}
