/**
 * Cobro en lote de cliente (pago múltiple CxC).
 * Un solo depósito del cliente contra varias facturas del mismo cliente y la
 * misma moneda. El reparto por defecto es FIFO por vencimiento y es editable
 * renglón por renglón.
 */
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency } from "@/lib/formatters";
import { usePagoClienteLoteState } from "@/features/facturacion/hooks/usePagoClienteLoteState";
import { DialogCobroLoteDatos } from "./DialogCobroLoteDatos";
import { DialogCobroLoteRenglones } from "./DialogCobroLoteRenglones";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
  clienteNombre: string;
  moneda: string;
  facturas: FacturaCobroCandidata[];
  onDone: () => void;
}

export function DialogCobroLoteCliente(p: Props) {
  const s = usePagoClienteLoteState({
    open: p.open,
    clienteId: p.clienteId,
    moneda: p.moneda,
    facturas: p.facturas,
    onOpenChange: p.onOpenChange,
    onDone: p.onDone,
  });

  const footer = (
    <>
      <Button variant="outline" onClick={() => p.onOpenChange(false)} disabled={s.guardando}>
        Cancelar
      </Button>
      <Button onClick={s.submit} disabled={!!s.error || s.guardando} title={s.error ?? undefined}>
        {s.guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {s.guardando ? "Guardando…" : "Aplicar cobro en lote"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={p.open}
      onOpenChange={p.onOpenChange}
      icon={Layers}
      title="Cobro en lote de cliente"
      description={`Un solo depósito de ${p.clienteNombre} repartido entre ${p.facturas.length} facturas en ${p.moneda}.`}
      size="xl"
      footer={footer}
    >
      <DialogCobroLoteDatos
        moneda={p.moneda}
        fecha={s.fecha}
        onFecha={s.setFecha}
        total={s.total}
        onTotal={s.recalcular}
        saldoTotal={s.saldoTotal}
        tcDof={s.tcDof}
        formaPago={s.formaPago}
        onFormaPago={s.setFormaPago}
        cuentaId={s.cuentaId}
        onCuentaId={s.setCuentaId}
        cuentasMoneda={s.cuentasMoneda}
        referencia={s.referencia}
        onReferencia={s.setReferencia}
      />

      <FormDialogSection
        title="Reparto entre facturas"
        description="Se aplica primero lo que vence antes. Puedes ajustar cada importe."
      >
        <DialogCobroLoteRenglones
          facturas={p.facturas}
          renglones={s.renglones}
          moneda={p.moneda}
          onMontoChange={s.setMonto}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Repartido: <strong className="tabular-nums">{formatCurrency(s.totalRepartido, p.moneda)}</strong>
          </span>
          <span className={s.sinAsignar > 0.009 ? "text-warning" : "text-muted-foreground"}>
            Sin asignar: <strong className="tabular-nums">{formatCurrency(s.sinAsignar, p.moneda)}</strong>
          </span>
        </div>
        {s.error && <p className="mt-2 text-xs text-destructive">{s.error}</p>}
      </FormDialogSection>

      <FormDialogSection title="Notas">
        <Textarea value={s.notas} onChange={(e) => s.setNotas(e.target.value)} rows={2} />
      </FormDialogSection>
    </FormDialogShell>
  );
}
