/**
 * Pago en lote a proveedor (v13.445.0).
 * Una transferencia (una referencia bancaria) contra varias facturas del mismo
 * proveedor y misma moneda. El reparto por defecto es FIFO por vencimiento y
 * es editable renglón por renglón.
 * v13.498.0: mismo layout/UX que el "Cobro en lote de cliente" (CxC).
 */
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { usePagoLoteState } from "@/features/cxp/hooks/usePagoLoteState";
import { type OrigenProveedor } from "./pagoProveedorHelpers";
import { DialogPagoLoteDatos } from "./DialogPagoLoteDatos";
import { DialogPagoLoteRenglones } from "./DialogPagoLoteRenglones";
import { DialogPagoLoteResumen } from "./DialogPagoLoteResumen";
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
      size="3xl"
      bodyClassName="py-4 space-y-4"
      headerAside={
        <div className="pr-6 leading-tight">
          <p className="text-overline text-muted-foreground">Saldo seleccionado</p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(s.saldoTotal, p.moneda)}
          </p>
        </div>
      }
      stickyBottom={
        <DialogPagoLoteResumen
          facturas={p.facturas}
          renglones={s.renglones}
          moneda={p.moneda}
          totalRepartido={s.totalRepartido}
          sinAsignar={s.sinAsignar}
          error={s.error}
        />
      }
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
        flat
        title="Reparto entre facturas"
        description="Se paga primero lo que vence antes. Puedes ajustar cada importe."
      >
        <DialogPagoLoteRenglones
          facturas={p.facturas}
          renglones={s.renglones}
          moneda={p.moneda}
          onMontoChange={s.setMonto}
        />
      </FormDialogSection>

      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label htmlFor="lote-notas">Notas</Label>
          <Textarea
            id="lote-notas"
            value={s.notas}
            onChange={(e) => s.setNotas(e.target.value)}
            rows={2}
            placeholder="Observaciones de la transferencia (opcional)"
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
