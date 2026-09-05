/**
 * NuevaActividadDialog — alta rápida de actividad para Lead u Oportunidad.
 * Usado por QuickAddMenu y por cualquier flujo que necesite crear una tarea.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { notifyError } from "@/lib/ui/appFeedback";

import {
  useCrearActividad,
  type CrmActividadTipo, type CrmEntidadTipo,
} from "@/features/crm/hooks";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { mxLocalToUtcIso } from "@/lib/date/mx";
import SelectorEntidadActividad from "@/features/crm/components/nuevaActividad/SelectorEntidadActividad";
import ActividadCamposFormulario from "@/features/crm/components/nuevaActividad/ActividadCamposFormulario";
import ActividadFlagsCheckboxes from "@/features/crm/components/nuevaActividad/ActividadFlagsCheckboxes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntidad?: { tipo: CrmEntidadTipo; id: string; label?: string };
  /** Borrador que viene del alta express ("Más campos →"): no se pierde lo capturado. */
  asuntoInicial?: string | null;
  fechaInicial?: string | null;
  entidadIdInicial?: string | null;
  onCreated?: (id: string) => void;
}

/** Valores iniciales del formulario (entidad fija o borrador del alta express). */
function valoresIniciales(p: Props) {
  return {
    entidadTipo: p.defaultEntidad?.tipo ?? "oportunidad",
    entidadId: p.defaultEntidad?.id ?? p.entidadIdInicial ?? "",
    asunto: p.asuntoInicial ?? "",
    fecha: p.fechaInicial ?? "",
  };
}

export default function NuevaActividadDialog({ open, onOpenChange, defaultEntidad, asuntoInicial, fechaInicial, entidadIdInicial, onCreated }: Props) {
  const crear = useCrearActividad();
  const enviandoRef = useRef(false);
  const ini = valoresIniciales({ open, onOpenChange, defaultEntidad, asuntoInicial, fechaInicial, entidadIdInicial });
  const [entidadTipo, setEntidadTipo] = useState<CrmEntidadTipo>(ini.entidadTipo);
  const [entidadId, setEntidadId] = useState<string>(ini.entidadId);
  const [tipo, setTipo] = useState<CrmActividadTipo>("tarea");
  const [asunto, setAsunto] = useState(ini.asunto);
  const [desc, setDesc] = useState("");
  const [fecha, setFecha] = useState(ini.fecha);
  const [contactoEfectivo, setContactoEfectivo] = useState(false);
  const [reunionCalificada, setReunionCalificada] = useState(false);

  // v13.823.50/51 — al reusar el diálogo con otra entidad (A → cerrar → B) se
  // reinicia el vínculo y TODO el borrador: lo capturado para A no viaja a B.
  const defTipo = ini.entidadTipo;
  const defId = ini.entidadId;
  const iniAsunto = ini.asunto;
  const iniFecha = ini.fecha;
  useEffect(() => {
    if (!open) return;
    setEntidadTipo(defTipo);
    setEntidadId(defId);
    setTipo("tarea"); setAsunto(iniAsunto); setDesc(""); setFecha(iniFecha);
    setContactoEfectivo(false); setReunionCalificada(false);
    setIntentado(false);
  }, [open, defTipo, defId, iniAsunto, iniFecha]);

  const isDirty = useMemo(
    () =>
      entidadTipo !== defTipo || entidadId !== defId ||
      tipo !== "tarea" || asunto !== iniAsunto || desc !== "" || fecha !== iniFecha ||
      contactoEfectivo || reunionCalificada,
    [entidadTipo, defTipo, entidadId, defId, tipo, asunto, iniAsunto, desc, fecha, iniFecha, contactoEfectivo, reunionCalificada],
  );

  // v13.823.77 — "Crear" no queda habilitado con Asunto u Oportunidad vacíos;
  // los campos se marcan con error accesible al primer intento.
  const [intentado, setIntentado] = useState(false);
  const faltaEntidad = !entidadId;
  const faltaAsunto = !asunto.trim();
  const incompleto = faltaEntidad || faltaAsunto;
  const errorEntidad = intentado && faltaEntidad;
  const errorAsunto = intentado && faltaAsunto;

  const handleSubmit = async () => {
    setIntentado(true);
    if (crear.isPending || enviandoRef.current) return;
    if (!entidadId) return notifyError(undefined, { title: "Selecciona la entidad", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
    if (!asunto.trim()) return notifyError(undefined, { title: "Asunto requerido", method: "HANDLE_SUBMIT", errorCode: ERROR_CODES.VALIDATION_FAILED });
    enviandoRef.current = true;
    try {
      const res = await crear.mutateAsync({
        tipo,
        asunto: asunto.trim(),
        descripcion: desc.trim(),
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        fecha_programada: mxLocalToUtcIso(fecha),
        contacto_efectivo: contactoEfectivo,
        reunion_calificada: reunionCalificada,
      });
      // Hallazgo #13.1: el toast de éxito/error ya lo emite `useCrearActividad`.
      onOpenChange(false);
      onCreated?.(res.id);
    } catch {
      // El toast de error ya lo emitió `useCrearActividad`.
    } finally {
      enviandoRef.current = false;
    }
  };

  const footer = (
    <FormDialogFooter
      onCancel={() => onOpenChange(false)}
      onConfirm={handleSubmit}
      confirmLabel="Crear"
      disabled={incompleto}
      loading={crear.isPending}
    />
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ClipboardList}
      title="Nueva actividad"
      description="Registra una tarea, llamada, reunión o nota."
      size="md"
      busy={crear.isPending}
      isDirty={isDirty}
      footer={footer}
    >
      {!defaultEntidad && (
        <SelectorEntidadActividad
          entidadTipo={entidadTipo}
          entidadId={entidadId}
          error={errorEntidad}
          onTipo={(t) => { setEntidadTipo(t); setEntidadId(""); }}
          onId={setEntidadId}
        />
      )}
      {defaultEntidad?.label && (
        <div className="text-body-sm text-muted-foreground">Para: <span className="font-medium text-foreground">{defaultEntidad.label}</span></div>
      )}
      <ActividadCamposFormulario
        tipo={tipo}
        onTipo={setTipo}
        fecha={fecha}
        onFecha={setFecha}
        asunto={asunto}
        onAsunto={setAsunto}
        errorAsunto={errorAsunto}
        desc={desc}
        onDesc={setDesc}
      />
      <ActividadFlagsCheckboxes
        contactoEfectivo={contactoEfectivo}
        onContactoEfectivo={setContactoEfectivo}
        reunionCalificada={reunionCalificada}
        onReunionCalificada={setReunionCalificada}
      />
    </FormDialogShell>
  );
}
