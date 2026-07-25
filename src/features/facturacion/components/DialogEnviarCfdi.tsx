/**
 * DialogEnviarCfdi — Confirma y envía el CFDI (factura, REP o NC) por email
 * al cliente vía FacturApi. Permite ver y elegir entre los contactos del
 * cliente antes de enviar para evitar mandarlo al destinatario equivocado.
 */
import { useEffect, useMemo, useState } from "react";
import { Mail, User, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useToast } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { enviarCfdiFactura, enviarCfdiRep, enviarCfdiNotaCredito } from "@/features/facturacion/services/enviarCfdiEmail";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import {
  useContactosClienteParaEnvio,
  type ContactoEnvio,
} from "@/features/facturacion/hooks/useContactosClienteParaEnvio";
import { notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors/index";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId?: string;
  pagoId?: string;
  notaCreditoId?: string;
  clienteId?: string;
  emailDefault?: string | null;
  titulo?: string;
  descripcion?: string;
}

function esValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function enviarCfdiPor(args: {
  facturaId?: string; pagoId?: string; notaCreditoId?: string; email: string;
}) {
  if (args.notaCreditoId) return enviarCfdiNotaCredito(args.notaCreditoId, args.email);
  if (args.facturaId) return enviarCfdiFactura(args.facturaId, args.email);
  if (args.pagoId) return enviarCfdiRep(args.pagoId, args.email);
  throw new Error("Falta facturaId, pagoId o notaCreditoId");
}

interface ContactoItemProps {
  contacto: ContactoEnvio;
  seleccionado: boolean;
  onPick: (email: string) => void;
}

function ContactoItem({ contacto: c, seleccionado, onPick }: ContactoItemProps) {
  return (
    <button
      type="button"
      onClick={() => onPick(c.email)}
      className={`text-left rounded-md border px-3 py-2 text-xs transition-colors ${
        seleccionado ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <User className="h-3 w-3 text-muted-foreground" />
          {c.nombre ?? "(Sin nombre)"}
          {c.esFacturacion && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">Facturación</Badge>
          )}
        </div>
        {c.tipo && !c.esFacturacion && (
          <span className="text-[10px] text-muted-foreground">{c.tipo}</span>
        )}
      </div>
      <div className="text-muted-foreground mt-0.5 truncate">{c.email}</div>
    </button>
  );
}

interface ContactosListProps {
  cargando: boolean;
  contactos: ContactoEnvio[];
  emailCliente: string | null | undefined;
  emailSeleccionado: string;
  onPick: (email: string) => void;
}

function ContactosList({ cargando, contactos, emailCliente, emailSeleccionado, onPick }: ContactosListProps) {
  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando contactos…
      </div>
    );
  }
  if (contactos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Este cliente no tiene contactos con email registrados.
        {emailCliente && " Se usará el email de la ficha del cliente."}
      </p>
    );
  }
  const seleccionadoLower = emailSeleccionado.trim().toLowerCase();
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
      {contactos.map((c) => (
        <ContactoItem
          key={c.id}
          contacto={c}
          seleccionado={seleccionadoLower === c.email.toLowerCase()}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

export function DialogEnviarCfdi({
  open, onOpenChange, facturaId, pagoId, notaCreditoId, clienteId, emailDefault, titulo, descripcion,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState(emailDefault ?? "");
  const [tocado, setTocado] = useState(Boolean(emailDefault));
  const [enviando, setEnviando] = useState(false);

  const { data: datosCliente, isLoading: cargandoContactos } = useContactosClienteParaEnvio(clienteId, open);

  useEffect(() => {
    if (!open || tocado) return;
    const sugerido = emailDefault ?? datosCliente?.emailSugerido ?? "";
    if (sugerido) setEmail(sugerido);
  }, [open, tocado, emailDefault, datosCliente?.emailSugerido]);

  useEffect(() => {
    if (!open) {
      setTocado(Boolean(emailDefault));
      setEmail(emailDefault ?? "");
    }
  }, [open, emailDefault]);

  const valido = esValido(email);
  const emailSugerido = datosCliente?.emailSugerido ?? null;
  const esOverride = valido && emailSugerido !== null && email.trim().toLowerCase() !== emailSugerido.toLowerCase();
  const contactos = useMemo(() => datosCliente?.contactos ?? [], [datosCliente]);

  const pickEmail = (nuevo: string) => { setEmail(nuevo); setTocado(true); };

  const onSubmit = async () => {
    if (!valido) return;
    setEnviando(true);
    try {
      const res = await enviarCfdiPor({ facturaId, pagoId, notaCreditoId, email: email.trim() });
      toast({ title: "CFDI enviado", description: `Se envió a ${res.enviado_a}.` });
      qc.invalidateQueries({ queryKey: facturasKeys.all });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo enviar el CFDI",
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    } finally {
      setEnviando(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
        Cancelar
      </Button>
      <Button onClick={onSubmit} disabled={!valido || enviando}>
        {enviando ? "Enviando…" : "Enviar CFDI"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      title={titulo ?? "Confirmar envío de CFDI"}
      description={descripcion ?? "Revisa el destinatario antes de mandar. FacturApi adjunta el PDF y XML."}
      size="md"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cfdi-email">Enviar a</Label>
          <Input
            id="cfdi-email"
            type="email"
            value={email}
            onChange={(e) => pickEmail(e.target.value)}
            placeholder="cliente@ejemplo.com"
            autoFocus
            aria-invalid={!valido && email.length > 0}
          />
          {esOverride && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Estás usando un email distinto al sugerido para este cliente.
            </p>
          )}
        </div>

        {clienteId && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Contactos del cliente
            </Label>
            <ContactosList
              cargando={cargandoContactos}
              contactos={contactos}
              emailCliente={datosCliente?.emailCliente}
              emailSeleccionado={email}
              onPick={pickEmail}
            />
          </div>
        )}
      </div>
    </FormDialogShell>
  );
}
