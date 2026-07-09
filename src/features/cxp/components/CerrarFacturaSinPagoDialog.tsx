/**
 * Diálogo para cerrar una factura de proveedor sin registrar un pago real.
 *
 * Usa la RPC `cerrar_factura_proveedor_sin_pago`, que:
 *   - exige factura aprobada y con saldo pendiente,
 *   - registra un ajuste tipificado en `pagos_proveedor` (es_ajuste = true),
 *   - marca la factura como Pagada,
 *   - escribe en bitácora.
 *
 * Doble confirmación: motivo obligatorio (select) + escribir "CERRAR".
 *
 * v13.204.0 · Ola A · A4
 * v13.232.0 · Migrado a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import {
  MOTIVOS_CIERRE_SIN_PAGO,
  type MotivoCierreSinPago,
} from "@/features/cxp/services/cerrarFacturaSinPago";

interface Props {
  factura: FacturaCxP | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onConfirm: (params: { motivo: MotivoCierreSinPago; comentario?: string }) => void | Promise<void>;
}

export function CerrarFacturaSinPagoDialog({
  factura, open, onOpenChange, isPending, onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoCierreSinPago | "">("");
  const [comentario, setComentario] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const descripcionMotivo = MOTIVOS_CIERRE_SIN_PAGO.find((m) => m.value === motivo)?.descripcion;
  const puedeConfirmar = motivo !== "" && confirmText.trim().toUpperCase() === "CERRAR";

  const handleOpenChange = (o: boolean) => {
    if (!o) { setMotivo(""); setComentario(""); setConfirmText(""); }
    onOpenChange(o);
  };

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="md"
      title="Cerrar factura sin pago"
      titleIcon={<AlertTriangle className="h-5 w-5 text-warning" aria-hidden />}
      confirmLabel="Cerrar factura"
      cancelLabel="Volver"
      confirmDisabled={!puedeConfirmar}
      isPending={isPending}
      onConfirm={() => {
        if (motivo === "") return;
        return onConfirm({ motivo, comentario: comentario.trim() || undefined });
      }}
      description={
        <div className="space-y-2 text-sm">
          <p>
            Vas a saldar la factura <strong>{factura?.folio_proveedor}</strong> de{" "}
            <strong>{factura?.proveedor_nombre}</strong> por un saldo de{" "}
            <strong>{factura ? formatCurrency(factura.saldo, factura.moneda) : "—"}</strong>{" "}
            sin registrar un pago real de dinero.
          </p>
          <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-1">
            <li>Se creará un ajuste tipificado en el histórico de pagos (marcado como ajuste, no como pago).</li>
            <li>La factura quedará marcada como <strong>Pagada</strong> y desaparecerá del aging.</li>
            <li>La acción queda registrada en la bitácora con tu usuario y el motivo.</li>
            <li>Requiere que la factura esté aprobada.</li>
          </ul>
        </div>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="cxp-cerrar-motivo" className="text-xs">
          Motivo <span className="text-destructive">*</span>
        </Label>
        <Select
          value={motivo}
          onValueChange={(v) => setMotivo(v as MotivoCierreSinPago)}
          disabled={isPending}
        >
          <SelectTrigger id="cxp-cerrar-motivo">
            <SelectValue placeholder="Selecciona un motivo" />
          </SelectTrigger>
          <SelectContent>
            {MOTIVOS_CIERRE_SIN_PAGO.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {descripcionMotivo && (
          <p className="text-[11px] text-muted-foreground pt-0.5">{descripcionMotivo}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cxp-cerrar-comentario" className="text-xs">
          Comentario adicional (opcional)
        </Label>
        <Textarea
          id="cxp-cerrar-comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Ej: se aplicó la NC-1234 emitida el 15/06 contra este folio."
          rows={2}
          maxLength={500}
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cxp-cerrar-confirm" className="text-xs">
          Escribe <span className="font-mono font-semibold">CERRAR</span> para confirmar
        </Label>
        <Input
          id="cxp-cerrar-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          disabled={isPending}
        />
      </div>
    </ConfirmActionDialog>
  );
}
