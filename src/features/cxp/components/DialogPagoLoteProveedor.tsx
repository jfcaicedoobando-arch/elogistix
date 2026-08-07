/**
 * Pago en lote a proveedor (v13.445.0).
 * Una transferencia (una referencia bancaria) contra varias facturas del mismo
 * proveedor y misma moneda. El reparto por defecto es FIFO por vencimiento y
 * es editable renglón por renglón.
 */
import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { usePagoProveedorLote } from "@/features/cxp/hooks/usePagoProveedorLote";
import { defaultMetodo, type OrigenProveedor } from "./pagoProveedorHelpers";
import { DialogPagoLoteDatos } from "./DialogPagoLoteDatos";
import { DialogPagoLoteRenglones } from "./DialogPagoLoteRenglones";
import { formatCurrency } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import {
  repartirFifo, validarLote, round2,
  type FacturaLoteCandidata, type RenglonLote,
} from "@/features/cxp/services/pagoProveedorLote";

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
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const registrar = usePagoProveedorLote();

  const saldoTotal = useMemo(
    () => round2(p.facturas.reduce((s, f) => s + Number(f.saldo || 0), 0)),
    [p.facturas],
  );

  const [fecha, setFecha] = useState(todayLocalISO());
  const [total, setTotal] = useState("");
  const [metodo, setMetodo] = useState(defaultMetodo(p.proveedorOrigen));
  const [referencia, setReferencia] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [notas, setNotas] = useState("");
  const [renglones, setRenglones] = useState<RenglonLote[]>([]);

  // Al abrir: importe sugerido = saldo total, reparto FIFO por vencimiento.
  useEffect(() => {
    if (!p.open) return;
    setFecha(todayLocalISO());
    setTotal(String(saldoTotal));
    setMetodo(defaultMetodo(p.proveedorOrigen));
    setReferencia("");
    setCuentaId("");
    setNotas("");
    setRenglones(repartirFifo(p.facturas, saldoTotal).renglones);
  }, [p.open, p.facturas, p.proveedorOrigen, saldoTotal]);

  // TC del pago = DOF de la fecha de pago (misma política que el pago individual).
  const esExtranjera = p.moneda !== "MXN";
  const { data: tcDof } = useTcDofPorFecha(p.open && esExtranjera ? fecha : null, p.open && esExtranjera);

  const totalNum = round2(Number(total) || 0);
  const cuentasMoneda = cuentas.filter((c) => c.moneda === p.moneda);
  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? null;
  const requiereCuenta = metodo !== "Efectivo";

  const { error, totalRepartido } = validarLote(p.facturas, renglones, totalNum, {
    requiereCuenta,
    cuentaId: cuentaId || null,
    monedaCuenta: cuenta?.moneda ?? null,
    moneda: p.moneda,
  });
  const sinAsignar = round2(totalNum - totalRepartido);

  const recalcular = (nuevoTotal: number) => {
    setTotal(nuevoTotal === 0 ? "" : String(nuevoTotal));
    setRenglones(repartirFifo(p.facturas, nuevoTotal).renglones);
  };

  const setMonto = (facturaId: string, monto: number) => {
    setRenglones((prev) =>
      prev.map((r) => (r.factura_id === facturaId ? { ...r, monto: round2(monto) } : r)),
    );
  };

  const submit = async () => {
    if (error) return;
    await registrar.mutateAsync({
      proveedor_id: p.proveedorId,
      fecha_pago: fecha,
      moneda: p.moneda,
      metodo_pago: metodo,
      referencia,
      cuenta_bancaria_id: cuentaId || null,
      tipo_cambio_usd: esExtranjera ? tcDof?.usdMxn ?? null : null,
      notas,
      renglones,
    });
    p.onOpenChange(false);
    p.onDone();
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => p.onOpenChange(false)} disabled={registrar.isPending}>
        Cancelar
      </Button>
      <Button onClick={submit} disabled={!!error || registrar.isPending} title={error ?? undefined}>
        {registrar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {registrar.isPending ? "Guardando…" : "Registrar pago en lote"}
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
        fecha={fecha}
        onFecha={setFecha}
        total={total}
        onTotal={recalcular}
        saldoTotal={saldoTotal}
        tcDof={esExtranjera ? tcDof ?? null : null}
        metodo={metodo}
        onMetodo={setMetodo}
        cuentaId={cuentaId}
        onCuentaId={setCuentaId}
        cuentasMoneda={cuentasMoneda}
        requiereCuenta={requiereCuenta}
        referencia={referencia}
        onReferencia={setReferencia}
      />

      <FormDialogSection
        title="Reparto entre facturas"
        description="Se sugiere pagar primero lo que vence antes. Puedes ajustar cada importe."
      >
        <DialogPagoLoteRenglones
          facturas={p.facturas}
          renglones={renglones}
          moneda={p.moneda}
          onMontoChange={setMonto}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Repartido: <strong className="tabular-nums">{formatCurrency(totalRepartido, p.moneda)}</strong>
          </span>
          <span className={sinAsignar > 0.009 ? "text-warning" : "text-muted-foreground"}>
            Sin asignar: <strong className="tabular-nums">{formatCurrency(sinAsignar, p.moneda)}</strong>
          </span>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </FormDialogSection>

      <FormDialogSection title="Notas">
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
      </FormDialogSection>
    </FormDialogShell>
  );
}
