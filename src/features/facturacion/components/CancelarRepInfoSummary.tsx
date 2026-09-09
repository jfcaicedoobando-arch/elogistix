/**
 * Resumen del REP a cancelar (folio, UUID, fecha y monto del pago) y selector
 * de motivo SAT. Se extrajo de `DialogCancelarRep` para respetar el límite de
 * 200 líneas por archivo. Sin lógica fiscal: sólo presentación.
 */
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import type { PagoRepInfo } from "@/features/facturacion/hooks/useCancelarRepController";

export function CancelarRepInfoSummary({ pago, labelRep }: { pago: PagoRepInfo; labelRep: string }) {
  const uuidCorto = pago.uuid_rep ? `${pago.uuid_rep.slice(0, 8)}…${pago.uuid_rep.slice(-8)}` : "";
  return (
    <div className="rounded-md border p-3 space-y-2 text-body bg-muted/30">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Folio REP</span>
        <span className="font-medium font-mono">{labelRep || "—"}</span>
      </div>
      {uuidCorto && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">UUID</span>
          <span className="font-mono text-body-sm">{uuidCorto}</span>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Fecha de pago</span>
        <span>{formatDate(pago.fecha_pago)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Monto</span>
        <span className="font-medium">{formatCurrency(Number(pago.monto), pago.moneda)}</span>
      </div>
    </div>
  );
}

export function CancelarRepMotivoSelector({
  motivo,
  onMotivoChange,
}: {
  motivo: MotivoCancelacionSat;
  onMotivoChange: (m: MotivoCancelacionSat) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Motivo SAT</Label>
      <Select value={motivo} onValueChange={(v) => onMotivoChange(v as MotivoCancelacionSat)}>
        <SelectTrigger aria-label="Motivo de cancelación SAT">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MOTIVOS_CANCELACION_SAT.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
