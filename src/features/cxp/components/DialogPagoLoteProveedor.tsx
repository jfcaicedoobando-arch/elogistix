/**
 * Pago en lote a proveedor (v13.445.0).
 * Una transferencia (una referencia bancaria) contra varias facturas del mismo
 * proveedor y misma moneda. El reparto por defecto es FIFO por vencimiento y
 * es editable renglón por renglón.
 */
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { usePagoLoteState } from "@/features/cxp/hooks/usePagoLoteState";
import { type OrigenProveedor } from "./pagoProveedorHelpers";
import { DialogPagoLoteDatos } from "./DialogPagoLoteDatos";
import { DialogPagoLoteRenglones } from "./DialogPagoLoteRenglones";
import { formatCurrency } from "@/lib/formatters";
import { type FacturaLoteCandidata } from "@/features/cxp/services/pagoProveedorLote";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  proveedorId: string;
  proveedorNombre: string;
  proveedorOrigen: OrigenProveedor;
  moneda: string;
  facturas: FacturaLoteCandidata[];
  onDone: () => void;
}

export function DialogPagoLoteProveedor(p: Props) {
  const s = usePagoLoteState({
    open: p.open,
    proveedorId: p.proveedorId,
    proveedorOrigen: p.proveedorOrigen,
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
        {s.guardando ? "Guardando…" : "Registrar pago en lote"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={p.open}
      onOpenChange={p.onOpenChange}
      icon={Layers}
      title="Pago en lote a proveedor"
      description={`Una sola transferencia a ${p.proveedorNombre} repartida entre ${p.facturas.length} facturas en ${p.moneda}.`}
      size="xl"
      footer={footer}
    >
      <DialogPagoLoteDatos
        moneda={p.moneda}
        proveedorOrigen={p.proveedorOrigen}
        fecha={s.fecha}
        onFecha={s.setFecha}
        total={s.total}
        onTotal={s.recalcular}
        saldoTotal={s.saldoTotal}
        tcDof={s.tcDof}
        metodo={s.metodo}
        onMetodo={s.setMetodo}
        cuentaId={s.cuentaId}
        onCuentaId={s.setCuentaId}
        cuentasMoneda={s.cuentasMoneda}
        requiereCuenta={s.requiereCuenta}
        referencia={s.referencia}
        onReferencia={s.setReferencia}
      />

      <FormDialogSection
        title="Reparto entre facturas"
        description="Se sugiere pagar primero lo que vence antes. Puedes ajustar cada importe."
      >
        <DialogPagoLoteRenglones
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
