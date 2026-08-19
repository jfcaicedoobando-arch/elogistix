/**
 * Cobro en lote de cliente (pago múltiple CxC).
 * Un solo depósito del cliente contra varias facturas del mismo cliente y la
 * misma moneda. El reparto por defecto es FIFO por vencimiento y es editable
 * renglón por renglón.
 */
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency } from "@/lib/formatters";
import { usePagoClienteLoteState } from "@/features/facturacion/hooks/usePagoClienteLoteState";
import { DialogCobroLoteAcciones } from "./DialogCobroLoteAcciones";
import { DialogCobroLoteDatos } from "./DialogCobroLoteDatos";

import { DialogCobroLoteRenglones } from "./DialogCobroLoteRenglones";
import { DialogCobroLoteResumen } from "./DialogCobroLoteResumen";
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
      <Button onClick={s.submit} disabled={!!s.error} title={s.error ?? undefined} loading={s.guardando}>
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
      size="3xl"
      bodyClassName="py-4 space-y-4"
      headerAside={
        <div className="pr-6 leading-tight">
          <p className="text-overline text-muted-foreground">Saldo seleccionado</p>
          <p className="text-body font-semibold tabular-nums">
            {formatCurrency(s.saldoTotal, p.moneda)}
          </p>
        </div>
      }
      stickyBottom={
        <DialogCobroLoteResumen
          facturas={p.facturas}
          renglones={s.renglones}
          moneda={p.moneda}
          recibido={s.totalNum}
          totalRepartido={s.totalRepartido}
          sinAsignar={s.sinAsignar}
          error={s.error}
          repRequeridos={s.repRequeridos}
          onAsignarSobrante={s.asignarSobrante}
        />
      }
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
        flat
        title="Reparto entre facturas"
        description="Se aplica primero lo que vence antes. Puedes ajustar cada importe o usar los atajos."
      >
        <div className="space-y-3">
          <DialogCobroLoteAcciones
            onFifo={s.repartirFifoAhora}
            onLiquidarTodo={s.liquidarTodo}
            onLimpiar={s.limpiarReparto}
            disabled={s.guardando}
          />
          <DialogCobroLoteRenglones
            facturas={p.facturas}
            renglones={s.renglones}
            moneda={p.moneda}
            erroresRenglon={s.erroresRenglon}
            idsConRep={s.idsConRep}
            onMontoChange={s.setMonto}
            onAsignarSaldo={s.asignarSaldo}
          />
        </div>
      </FormDialogSection>


      <FormDialogSection flat>
        <div className="space-y-1.5">
          <Label htmlFor="cobro-lote-notas">Notas</Label>
          <Textarea
            id="cobro-lote-notas"
            value={s.notas}
            onChange={(e) => s.setNotas(e.target.value)}
            rows={2}
            placeholder="Observaciones del depósito (opcional)"
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
