/**
 * Diálogo del portal para que el cliente solicite una cotización.
 * Sólo captura ruta y datos mínimos: el equipo comercial cotiza con tarifa.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Send } from "lucide-react";
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
  const [modo, setModo] = useState<ModoTransporte>("Marítimo");
  const [tipo, setTipo] = useState<TipoOperacion>("Importación");
  const [tipoEmbarque, setTipoEmbarque] = useState<string>("FCL");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [mercancia, setMercancia] = useState("");
  const [notas, setNotas] = useState("");

  const puedeEnviar = Boolean(clienteId) && origen.trim().length > 0 && destino.trim().length > 0;

  const reset = () => {
    setModo("Marítimo");
    setTipo("Importación");
    setTipoEmbarque("FCL");
    setOrigen("");
    setDestino("");
    setMercancia("");
    setNotas("");
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
          <Button onClick={handleSubmit} disabled={!puedeEnviar || solicitar.isPending}>
            {solicitar.isPending
              ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
              : <Send className="h-4 w-4 mr-1" />}
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
            placeholder="Shanghái, China" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solicitud-destino">Destino <span className="text-destructive">*</span></Label>
          <Input id="solicitud-destino" value={destino} onChange={(e) => setDestino(e.target.value)}
            placeholder="Manzanillo, México" />
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
    </FormDialogShell>
  );
}
