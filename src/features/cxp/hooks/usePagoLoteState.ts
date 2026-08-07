/**
 * Estado, validación y envío del pago en lote a proveedor.
 * Extraído v13.450.2 para mantener el diálogo bajo el límite de complejidad.
 */
import { useEffect, useMemo, useState } from "react";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { usePagoProveedorLote } from "@/features/cxp/hooks/usePagoProveedorLote";
import { defaultMetodo, type OrigenProveedor } from "@/features/cxp/components/pagoProveedorHelpers";
import { todayLocalISO } from "@/lib/date/today";
import {
  repartirFifo, validarLote, round2,
  type FacturaLoteCandidata, type RenglonLote,
} from "@/features/cxp/services/pagoProveedorLote";

interface Args {
  open: boolean;
  proveedorId: string;
  proveedorOrigen: OrigenProveedor;
  moneda: string;
  facturas: FacturaLoteCandidata[];
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

export function usePagoLoteState(a: Args) {
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const registrar = usePagoProveedorLote();

  const saldoTotal = useMemo(
    () => round2(a.facturas.reduce((s, f) => s + Number(f.saldo || 0), 0)),
    [a.facturas],
  );

  const [fecha, setFecha] = useState(todayLocalISO());
  const [total, setTotal] = useState("");
  const [metodo, setMetodo] = useState(defaultMetodo(a.proveedorOrigen));
  const [referencia, setReferencia] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [notas, setNotas] = useState("");
  const [renglones, setRenglones] = useState<RenglonLote[]>([]);

  // Al abrir: importe sugerido = saldo total, reparto FIFO por vencimiento.
  useEffect(() => {
    if (!a.open) return;
    setFecha(todayLocalISO());
    setTotal(String(saldoTotal));
    setMetodo(defaultMetodo(a.proveedorOrigen));
    setReferencia("");
    setCuentaId("");
    setNotas("");
    setRenglones(repartirFifo(a.facturas, saldoTotal).renglones);
  }, [a.open, a.facturas, a.proveedorOrigen, saldoTotal]);

  // TC del pago = DOF de la fecha de pago (misma política que el pago individual).
  const esExtranjera = a.moneda !== "MXN";
  const pedirTc = a.open && esExtranjera;
  const { data: tcDofRaw } = useTcDofPorFecha(pedirTc ? fecha : null, pedirTc);
  const tcDof = esExtranjera ? tcDofRaw ?? null : null;

  const totalNum = round2(Number(total) || 0);
  const cuentasMoneda = cuentas.filter((c) => c.moneda === a.moneda);
  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? null;
  const requiereCuenta = metodo !== "Efectivo";

  const { error, totalRepartido } = validarLote(a.facturas, renglones, totalNum, {
    requiereCuenta,
    cuentaId: cuentaId || null,
    monedaCuenta: cuenta?.moneda ?? null,
    moneda: a.moneda,
  });
  const sinAsignar = round2(totalNum - totalRepartido);

  const recalcular = (nuevoTotal: number) => {
    setTotal(nuevoTotal === 0 ? "" : String(nuevoTotal));
    setRenglones(repartirFifo(a.facturas, nuevoTotal).renglones);
  };

  const setMonto = (facturaId: string, monto: number) => {
    setRenglones((prev) =>
      prev.map((r) => (r.factura_id === facturaId ? { ...r, monto: round2(monto) } : r)),
    );
  };

  const submit = async () => {
    if (error) return;
    await registrar.mutateAsync({
      proveedor_id: a.proveedorId,
      fecha_pago: fecha,
      moneda: a.moneda,
      metodo_pago: metodo,
      referencia,
      cuenta_bancaria_id: cuentaId || null,
      tipo_cambio_usd: tcDof?.usdMxn ?? null,
      notas,
      renglones,
    });
    a.onOpenChange(false);
    a.onDone();
  };

  return {
    fecha, setFecha, total, metodo, setMetodo, referencia, setReferencia,
    cuentaId, setCuentaId, notas, setNotas, renglones,
    saldoTotal, tcDof, cuentasMoneda, requiereCuenta,
    error, sinAsignar, recalcular, setMonto, submit,
    guardando: registrar.isPending,
  };
}
