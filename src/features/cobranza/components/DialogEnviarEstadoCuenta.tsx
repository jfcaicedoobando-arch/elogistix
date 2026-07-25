/**
 * DialogEnviarEstadoCuenta — envía el estado de cuenta del cliente por email.
 *
 * QW12 Tanda 3 — Quick Wins facturación.
 */
import { useMemo, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEstadoCuentaEmail } from "@/features/cobranza/hooks/useEstadoCuentaEmail";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaEstadoCuenta } from "@/features/facturacion/estadoCuenta/services/estadoCuenta";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNombre: string | null;
  periodo: string;
  desde: string;
  hasta: string;
  rows: ReadonlyArray<FacturaEstadoCuenta>;
}

export function DialogEnviarEstadoCuenta({
  open, onOpenChange, clienteId, clienteNombre, periodo, desde, hasta, rows,
}: Props) {
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");

  const totales = useMemo(() => {
    const validas = rows.filter((r) => r.saldo !== null && r.total !== null);
    const total = validas.reduce((acc, r) => acc + (r.total ?? 0), 0);
    const saldo = validas.reduce((acc, r) => acc + (r.saldo ?? 0), 0);
    const vencido = validas
      .filter((r) => r.dias_vencido && r.dias_vencido > 0)
      .reduce((acc, r) => acc + (r.saldo ?? 0), 0);
    return { total, saldo, vencido };
  }, [rows]);

  const moneda = rows[0]?.moneda ?? "MXN";

  const { mutate, isPending } = useEstadoCuentaEmail({
    onSuccess: () => {
      setEmail("");
      setMensaje("");
      onOpenChange(false);
    },
  });

  const emailValido = email.trim() === "" || email.includes("@");
  const puedeEnviar = !isPending && emailValido;

  const handleEnviar = () => {
    mutate({
      clienteId,
      periodo,
      contactoEmail: email.trim() || undefined,
      mensaje: mensaje.trim() || undefined,
      fechaDesde: desde,
      fechaHasta: hasta,
    });
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
        Cancelar
      </Button>
      <Button onClick={handleEnviar} disabled={!puedeEnviar}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          "Enviar estado de cuenta"
        )}
      </Button>
    </div>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      title="Enviar estado de cuenta por email"
      description={clienteNombre ?? "Cliente"}
      size="md"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold">{formatCurrency(totales.total, moneda)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground">Saldo</p>
            <p className="font-semibold">{formatCurrency(totales.saldo, moneda)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground">Vencido</p>
            <p className="font-semibold text-destructive">{formatCurrency(totales.vencido, moneda)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-estado-cuenta">Correo del destinatario (opcional)</Label>
          <Input
            id="email-estado-cuenta"
            type="email"
            placeholder="contacto@cliente.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Si lo dejas vacío, usamos el correo principal del cliente.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mensaje-estado-cuenta">Mensaje opcional</Label>
          <Textarea
            id="mensaje-estado-cuenta"
            placeholder="Ej. Te comparto tu estado de cuenta al cierre del periodo. Quedo atento a cualquier duda."
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>
      </div>
    </FormDialogShell>
  );
}
