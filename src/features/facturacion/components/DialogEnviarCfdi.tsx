/**
 * DialogEnviarCfdi — Confirma y envía el CFDI (factura, REP o NC) por email
 * al cliente vía FacturApi. Permite ver y elegir entre los contactos del
 * cliente antes de enviar para evitar mandarlo al destinatario equivocado.
 */
import { useEffect, useMemo, useState } from "react";
import { Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useToast } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { enviarCfdiFactura, enviarCfdiRep, enviarCfdiNotaCredito } from "@/features/facturacion/services/enviarCfdiEmail";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { useContactosClienteParaEnvio } from "@/features/facturacion/hooks/useContactosClienteParaEnvio";
import { ContactosClienteList } from "@/features/facturacion/components/ContactosClienteList";
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
      notifyError(undefined, {
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
            <p className="text-xs text-warning flex items-center gap-1">
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
            <ContactosClienteList
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
