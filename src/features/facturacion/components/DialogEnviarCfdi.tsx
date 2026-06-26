/**
 * DialogEnviarCfdi — Reenvía el CFDI (factura o REP) por email al cliente
 * usando FacturApi. Permite editar el destinatario antes de enviar.
 */
import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useToast } from "@/hooks/shared";
import { enviarCfdiFactura, enviarCfdiRep } from "@/features/facturacion/services/enviarCfdiEmail";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId?: string;
  pagoId?: string;
  emailDefault?: string | null;
  titulo?: string;
}

export function DialogEnviarCfdi({
  open, onOpenChange, facturaId, pagoId, emailDefault, titulo,
}: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState(emailDefault ?? "");
  const [enviando, setEnviando] = useState(false);

  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSubmit = async () => {
    if (!valido) return;
    setEnviando(true);
    try {
      const res = facturaId
        ? await enviarCfdiFactura(facturaId, email.trim())
        : await enviarCfdiRep(pagoId!, email.trim());
      toast({
        title: "CFDI enviado",
        description: `Se envió a ${res.enviado_a}.`,
      });
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
      title={titulo ?? "Enviar CFDI por email"}
      description="FacturApi envía el PDF y XML adjuntos al destinatario."
      size="md"
      footer={footer}
    >
      <div className="space-y-2">
        <Label htmlFor="cfdi-email">Email del destinatario</Label>
        <Input
          id="cfdi-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cliente@ejemplo.com"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Puedes editarlo si quieres enviarlo a otra dirección.
        </p>
      </div>
    </FormDialogShell>
  );
}
