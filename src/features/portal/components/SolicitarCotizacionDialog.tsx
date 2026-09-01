/**
 * Diálogo del portal para que el cliente solicite una cotización.
 * Sólo captura ruta y datos mínimos: el equipo comercial cotiza con tarifa.
 * v13.823.12 — la empresa solicitante se elige explícitamente (multicliente).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSolicitarCotizacion } from "@/features/portal/hooks/useSolicitarCotizacion";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { guardarSolicitudPreferencias } from "@/features/portal/domain/solicitudPreferencias";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import { FaltantesHint } from "@/features/facturacion/components/FaltantesHint";
import { useFormDialogCerrar } from "@/components/shared/formDialogCloseContext";
import { useSolicitudCotizacionForm } from "@/features/portal/hooks/useSolicitudCotizacionForm";
import { SolicitanteSelect } from "@/features/portal/components/SolicitanteSelect";
import { SolicitudServicioFields } from "@/features/portal/components/SolicitudServicioFields";
import {
  seleccionInicial,
  type ClienteSolicitante,
} from "@/features/portal/domain/clientesSolicitantes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Empresas autorizadas para el usuario (RLS). Con una sola se preselecciona. */
  clientes: ClienteSolicitante[];
}

export function SolicitarCotizacionDialog({ open, onOpenChange, clientes }: Props) {
  const navigate = useNavigate();
  // La mutación sigue recibiendo TODOS los ids autorizados: la validación y la
  // invalidación de caché no se debilitan por la elección de la UI.
  const clienteIds = useMemo(() => clientes.map((c) => c.id), [clientes]);
  const solicitar = useSolicitarCotizacion(clienteIds);
  const cerrar = useFormDialogCerrar();

  // Con una sola empresa se preselecciona en cuanto cargan los vínculos; con
  // varias nunca se preselecciona (evita atribuir la solicitud a la equivocada).
  const [clienteId, setClienteId] = useState(() => seleccionInicial(clientes));
  // También al cerrar: reabrir en multicliente exige elegir de nuevo, así una
  // selección vieja no manda la solicitud a la empresa equivocada.
  useEffect(() => setClienteId(seleccionInicial(clientes)), [clientes, open]);

  const f = useSolicitudCotizacionForm(clienteId || undefined);
  const {
    modo, setModo, tipo, setTipo, tipoEmbarque, setTipoEmbarque,
    origen, setOrigen, destino, setDestino, mercancia, setMercancia, notas, setNotas,
    intentoEnvio, origenVacio, destinoVacio, puedeEnviar, isDirty, faltantes, reset,
  } = f;

  /** Al cerrar se limpia también la empresa elegida: reabrir con varias
   *  empresas exige elegir de nuevo. */
  const resetTodo = () => {
    reset();
    setClienteId(seleccionInicial(clientes));
  };

  const handleSubmit = async () => {
    f.setIntentoEnvio(true);
    if (!puedeEnviar || !clienteId) return;

    try {
      const res = await solicitar.mutateAsync({
        clienteId,
        modo,
        tipo,
        origen,
        destino,
        tipoEmbarque,
        descripcionMercancia: mercancia,
        notas,
      });
      guardarSolicitudPreferencias({ modo, tipo, tipoEmbarque });
      notifySuccess(undefined, {
        title: "Solicitud enviada",
        description: `Registramos tu solicitud ${res.folio}. Nuestro equipo te enviará la cotización.`,
      });
      resetTodo();
      onOpenChange(false);
      navigate("/portal/cotizaciones");
    } catch (error: unknown) {
      notifyError(undefined, {
        title: "No pudimos enviar la solicitud",
        description: getErrorMessage(error),
        error,
        method: "PORTAL_SOLICITAR_COTIZACION",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) resetTodo();
        onOpenChange(abierto);
      }}
      icon={FileText}
      title="Solicitar cotización"
      description="Cuéntanos la ruta y tu carga; te enviaremos una propuesta."
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          {intentoEnvio && !puedeEnviar && (
            <FaltantesHint items={faltantes} className="mr-auto" />
          )}
          <Button variant="outline" onClick={() => (cerrar ? cerrar() : onOpenChange(false))}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={solicitar.isPending} disabled={!clienteId}>
            {!solicitar.isPending && <Send className="h-4 w-4 mr-1" />}
            {solicitar.isPending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </>
      }
    >
      <SolicitanteSelect
        clientes={clientes}
        value={clienteId}
        onChange={setClienteId}
        intentoEnvio={intentoEnvio}
      />

      <SolicitudServicioFields
        modo={modo} setModo={setModo}
        tipo={tipo} setTipo={setTipo}
        tipoEmbarque={tipoEmbarque} setTipoEmbarque={setTipoEmbarque}
      />

      <FormDialogSection title="Ruta" description="Puerto, aeropuerto o ciudad.">
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-origen">Origen <span className="text-destructive">*</span></Label>
          <Input id="solicitud-origen" value={origen} onChange={(e) => setOrigen(e.target.value)}
            placeholder="Shanghái, China" aria-invalid={intentoEnvio && origenVacio} />
          {intentoEnvio && origenVacio && (
            <p className="text-body-sm text-destructive">{COPY_VALIDACION.requerido("el origen")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-destino">Destino <span className="text-destructive">*</span></Label>
          <Input id="solicitud-destino" value={destino} onChange={(e) => setDestino(e.target.value)}
            placeholder="Manzanillo, México" aria-invalid={intentoEnvio && destinoVacio} />
          {intentoEnvio && destinoVacio && (
            <p className="text-body-sm text-destructive">{COPY_VALIDACION.requerido("el destino")}</p>
          )}
        </div>
      </FormDialogSection>

      <FormDialogSection title="Carga" cols={1}>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-mercancia">Descripción de la mercancía</Label>
          <Input id="solicitud-mercancia" value={mercancia} onChange={(e) => setMercancia(e.target.value)}
            placeholder="Refacciones automotrices" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-notas">Notas para el equipo</Label>
          <Textarea id="solicitud-notas" value={notas} onChange={(e) => setNotas(e.target.value)}
            rows={3} placeholder="Fechas estimadas, número de contenedores, requerimientos especiales…" />
        </div>
      </FormDialogSection>

      {intentoEnvio && !puedeEnviar && (
        <p className="text-body-sm text-destructive font-medium">{COPY_VALIDACION.camposObligatorios}</p>
      )}
    </FormDialogShell>
  );
}
