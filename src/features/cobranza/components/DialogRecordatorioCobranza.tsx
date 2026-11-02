/**
 * DialogRecordatorioCobranza — envía un recordatorio de pago manual por email.
 *
 * v13.313.1
 */
import { useState } from "react";
import { Mail } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRecordatorioCobranza } from "@/features/cobranza/hooks/useRecordatorioCobranza";
import { useDestinatarioRecordatorio } from "@/features/cobranza/hooks/useDestinatarioRecordatorio";
import { DestinatarioRecordatorioAviso } from "./DestinatarioRecordatorioAviso";
import { formatCurrency } from "@/lib/formatters";

export interface FacturaRecordatorio {
  factura_id: string;
  numero: string | null;
  total: number;
  saldo: number;
  moneda: string;
  dias_vencido: number;
  fecha_vencimiento?: string | null;
  cliente_nombre?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factura: FacturaRecordatorio | null;
}

export function DialogRecordatorioCobranza({ open, onOpenChange, factura }: Props) {
  const [nota, setNota] = useState("");
  const destinatario = useDestinatarioRecordatorio(factura?.factura_id, open);
  const { mutate, isPending } = useRecordatorioCobranza({
    onSuccess: () => {
      setNota("");
      onOpenChange(false);
    },
  });

  if (!factura) return null;

  const vencida = factura.dias_vencido > 0;
  const saldo = factura.saldo ?? factura.total ?? 0;
  const email = destinatario.data?.factura_id === factura.factura_id ? destinatario.data.destinatario : null;
  const consultando = destinatario.isPending || destinatario.isFetching;
  const puedeEnviar = open && !isPending && !consultando && !destinatario.isError && !!email;

  const handleEnviar = () => {
    if (!puedeEnviar || !email || !destinatario.isCurrentScope()) return;
    mutate({ facturaId: factura.factura_id, nota: nota.trim(), contactoEmail: email });
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
        Cancelar
      </Button>
      <Button onClick={handleEnviar} disabled={!puedeEnviar} loading={isPending}>
          {isPending ? "Enviando…" : (
          "Enviar recordatorio"
        )}
      </Button>
    </div>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      title={`Recordatorio de pago — ${factura.numero}`}
      description={`${factura.cliente_nombre ?? "Cliente"} · Saldo ${formatCurrency(saldo, factura.moneda)} · ${vencida ? `Vencida ${factura.dias_vencido}d` : `Por vencer ${Math.abs(factura.dias_vencido)}d`}`}
      size="md"
      busy={isPending}
      footer={footer}
    >
      <div className="space-y-4">
        <DestinatarioRecordatorioAviso
          email={email}
          isLoading={consultando}
          isError={destinatario.isError}
          onRetry={() => { void destinatario.refetch(); }}
          disabled={isPending}
        />
        <div className="space-y-2">
          <Label htmlFor="nota-recordatorio">Mensaje opcional</Label>
          <Textarea
            id="nota-recordatorio"
            placeholder="Ej. Quedamos atentos a tu pago. Cualquier aclaración, con gusto te apoyamos."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={4}
            maxLength={2000}
          />
        </div>
      </div>
    </FormDialogShell>
  );
}
