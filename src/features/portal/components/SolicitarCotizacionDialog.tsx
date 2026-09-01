/**
 * Diálogo del portal para que el cliente solicite una cotización.
 * Sólo captura ruta y datos mínimos: el equipo comercial cotiza con tarifa.
 * v13.821.7
 */
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
import { guardarSolicitudPreferencias } from "@/features/portal/domain/solicitudPreferencias";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import { FaltantesHint } from "@/features/facturacion/components/FaltantesHint";
import { useFormDialogCerrar } from "@/components/shared/formDialogCloseContext";
import { useSolicitudCotizacionForm } from "@/features/portal/hooks/useSolicitudCotizacionForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Empresas autorizadas para el usuario (RLS). Con una sola se preselecciona. */
  clientes: ClienteSolicitante[];
}

const TIPOS_EMBARQUE = ["FCL", "LCL", "Aéreo", "Terrestre"] as const;

export function SolicitarCotizacionDialog({ open, onOpenChange, clientes }: Props) {
  const navigate = useNavigate();
  // La mutación sigue recibiendo TODOS los ids autorizados: la validación y la
  // invalidación de caché no se debilitan por la elección de la UI.
  const clienteIds = useMemo(() => clientes.map((c) => c.id), [clientes]);
  const solicitar = useSolicitarCotizacion(clienteIds);
  const cerrar = useFormDialogCerrar();

  const inicial = seleccionInicial(clientes);
  const [clienteId, setClienteId] = useState(inicial);
  // Con una sola empresa se preselecciona en cuanto cargan los vínculos; con
  // varias nunca se preselecciona (evita atribuir la solicitud a la equivocada).
  useEffect(() => setClienteId(seleccionInicial(clientes)), [clientes]);

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
      onOpenChange={(abierto) => {
        if (!abierto) reset();
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
          <Button onClick={handleSubmit} loading={solicitar.isPending}>
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
