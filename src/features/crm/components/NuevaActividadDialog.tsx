/**
 * NuevaActividadDialog — alta rápida de actividad para Lead u Oportunidad.
 * Usado por QuickAddMenu y por cualquier flujo que necesite crear una tarea.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { crmToast } from "@/features/crm/lib/crmToast";
import {
  ACTIVIDAD_TIPOS, useCrearActividad,
  type CrmActividadTipo, type CrmEntidadTipo,
} from "@/features/crm/hooks";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { LeadComboboxCrm, OportunidadComboboxCrm } from "@/features/crm/components/comboboxes/EntidadComboboxCrm";

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
  const [contactoEfectivo, setContactoEfectivo] = useState(false);
  const [reunionCalificada, setReunionCalificada] = useState(false);

  // v13.823.50 — el estado se inicializaba sólo en el primer render: al reusar
  // el diálogo con otra oportunidad (A → cerrar → B) mostraba el nombre de B
  // pero conservaba el id de A (o vacío).
  // v13.823.51 — además del vínculo se reinicia TODO el borrador (tipo, asunto,
  // descripción, fecha y banderas de calidad): lo capturado para A no debe
  // viajar a B.
  const defTipo = defaultEntidad?.tipo;
  const defId = defaultEntidad?.id;
  useEffect(() => {
    if (!open) return;
    setEntidadTipo(defTipo ?? "oportunidad");
    setEntidadId(defId ?? "");
    setTipo("tarea"); setAsunto(""); setDesc(""); setFecha("");
    setContactoEfectivo(false); setReunionCalificada(false);
  }, [open, defTipo, defId]);

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
        contacto_efectivo: contactoEfectivo,
        reunion_calificada: reunionCalificada,
      });
      crmToast.success("Actividad creada");
      onOpenChange(false);
      onCreated?.(res.id);
    } catch (e) {
      notifyError(undefined, { title: "No se pudo crear", description: getErrorMessage(e), error: e, method: "HANDLE_SUBMIT" });
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={handleSubmit} loading={crear.isPending}>
        Crear
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            {entidadTipo === "lead" ? (
              <LeadComboboxCrm value={entidadId} onChange={(id) => setEntidadId(id)} />
            ) : (
              <OportunidadComboboxCrm value={entidadId} onChange={(id) => setEntidadId(id)} />
            )}
          </div>
        </div>
      )}
      {defaultEntidad?.label && (
        <div className="text-body-sm text-muted-foreground">Para: <span className="font-medium text-foreground">{defaultEntidad.label}</span></div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <Label htmlFor="nueva-actividad-asunto">Asunto</Label>
        <Input id="nueva-actividad-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Llamar a cliente, enviar cotización…" />
      </div>
      <div className="space-y-1">
        <Label>Descripción</Label>
        <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="act-contacto-efectivo"
            checked={contactoEfectivo}
            onCheckedChange={(v) => setContactoEfectivo(v === true)}
          />
          <Label size="sm" htmlFor="act-contacto-efectivo" className="cursor-pointer">
            Contacto efectivo (hablé con quien decide)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="act-reunion-calificada"
            checked={reunionCalificada}
            onCheckedChange={(v) => setReunionCalificada(v === true)}
          />
          <Label size="sm" htmlFor="act-reunion-calificada" className="cursor-pointer">
            Reunión calificada (con necesidad y presupuesto)
          </Label>
        </div>
      </div>
    </FormDialogShell>
  );
}
