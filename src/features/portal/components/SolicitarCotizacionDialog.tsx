/**
 * Diálogo del portal para que el cliente solicite una cotización.
 * Sólo captura ruta y datos mínimos: el equipo comercial cotiza con tarifa.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODOS, TIPOS, type ModoTransporte, type TipoOperacion } from "@/constants/wizardConstants";
import { useSolicitarCotizacion } from "@/features/portal/hooks/useSolicitarCotizacion";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  guardarSolicitudPreferencias,
  leerSolicitudPreferencias,
} from "@/features/portal/domain/solicitudPreferencias";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId?: string;
  clienteIds: string[];
}

const TIPOS_EMBARQUE = ["FCL", "LCL", "Aéreo", "Terrestre"] as const;

export function SolicitarCotizacionDialog({ open, onOpenChange, clienteId, clienteIds }: Props) {
  const navigate = useNavigate();
  const solicitar = useSolicitarCotizacion(clienteIds);
  // P2-6.7: se recuerda la última elección del cliente en lugar de forzar
  // siempre Marítimo / Importación / FCL.
  const prefsIniciales = leerSolicitudPreferencias();
  const [modo, setModo] = useState<ModoTransporte>(prefsIniciales.modo as ModoTransporte);
  const [tipo, setTipo] = useState<TipoOperacion>(prefsIniciales.tipo as TipoOperacion);
  const [tipoEmbarque, setTipoEmbarque] = useState<string>(prefsIniciales.tipoEmbarque);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [mercancia, setMercancia] = useState("");
  const [notas, setNotas] = useState("");
  // RUX-07: los errores/hints de obligatoriedad sólo se muestran tras el
  // primer intento de envío, nunca en campos vírgenes.
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const puedeEnviar = Boolean(clienteId) && origen.trim().length > 0 && destino.trim().length > 0;

  const reset = () => {
    const prefs = leerSolicitudPreferencias();
    setModo(prefs.modo as ModoTransporte);
    setTipo(prefs.tipo as TipoOperacion);
    setTipoEmbarque(prefs.tipoEmbarque);
    setOrigen("");
    setDestino("");
    setMercancia("");
    setNotas("");
    setIntentoEnvio(false);
  };

  const handleSubmit = async () => {
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
      reset();
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
      onOpenChange={(abierto) => { if (!abierto) reset(); onOpenChange(abierto); }}
      icon={FileText}
      title="Solicitar cotización"
      description="Cuéntanos la ruta y tu carga; te enviaremos una propuesta."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!puedeEnviar} loading={solicitar.isPending}>
            {!solicitar.isPending && <Send className="h-4 w-4 mr-1" />}
            {solicitar.isPending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </>
      }
    >
      <FormDialogSection title="Servicio">
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-modo">Modo de transporte</Label>
          <Select value={modo} onValueChange={(v) => setModo(v as ModoTransporte)}>
            <SelectTrigger id="solicitud-modo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-tipo">Tipo de operación</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoOperacion)}>
            <SelectTrigger id="solicitud-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-embarque">Tipo de embarque</Label>
          <Select value={tipoEmbarque} onValueChange={setTipoEmbarque}>
            <SelectTrigger id="solicitud-embarque"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_EMBARQUE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Ruta" description="Puerto, aeropuerto o ciudad.">
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-origen">Origen <span className="text-destructive">*</span></Label>
          <Input id="solicitud-origen" value={origen} onChange={(e) => setOrigen(e.target.value)}
            placeholder="Shanghái, China" aria-invalid={intentoEnvio && origen.trim() === ""} />
          {intentoEnvio && origen.trim() === "" && (
            <p className="text-xs text-muted-foreground">{COPY_VALIDACION.requerido("el origen")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-destino">Destino <span className="text-destructive">*</span></Label>
          <Input id="solicitud-destino" value={destino} onChange={(e) => setDestino(e.target.value)}
            placeholder="Manzanillo, México" aria-invalid={intentoEnvio && destino.trim() === ""} />
          {intentoEnvio && destino.trim() === "" && (
            <p className="text-xs text-muted-foreground">{COPY_VALIDACION.requerido("el destino")}</p>
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
        <p className="text-xs text-muted-foreground">{COPY_VALIDACION.camposObligatorios}</p>
      )}
    </FormDialogShell>
  );
}
