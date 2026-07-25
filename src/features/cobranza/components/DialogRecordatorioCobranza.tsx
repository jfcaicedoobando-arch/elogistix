/**
 * DialogRecordatorioCobranza — envía un recordatorio de pago manual por email.
 *
 * v13.313.1
 */
import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRecordatorioCobranza } from "@/features/cobranza/hooks/useRecordatorioCobranza";
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
  const { mutate, isPending } = useRecordatorioCobranza({
    onSuccess: () => {
      setNota("");
      onOpenChange(false);
    },
  });

  if (!factura) return null;

  const vencida = factura.dias_vencido > 0;
  const saldo = factura.saldo ?? factura.total ?? 0;
  const puedeEnviar = !isPending;

  const handleEnviar = () => {
    mutate({ facturaId: factura.id, nota: nota.trim() });
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
      footer={footer}
    >
      <div className="space-y-4">
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
          <p className="text-xs text-muted-foreground">
            El correo se enviará al contacto principal del cliente. Si no hay correo, se pedirá elegir uno.
          </p>
        </div>
      </div>
    </FormDialogShell>
  );
}
