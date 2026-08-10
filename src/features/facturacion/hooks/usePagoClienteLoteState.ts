/**
 * Estado, validación y envío del cobro en lote de cliente.
 * Mantiene el diálogo bajo el límite de complejidad y de líneas.
 */
import { useEffect, useMemo, useState } from "react";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { usePagoClienteLote } from "@/features/facturacion/hooks/usePagoClienteLote";
import { todayLocalISO } from "@/lib/date/today";
import {
  obtenerFacturasConRep,
  repartirFifo,
  round2,
  validarCobroLote,
  type FacturaCobroCandidata,
  type RenglonCobro,
} from "@/features/facturacion/services/pagoClienteLote";

interface Args {
  open: boolean;
  clienteId: string;
  moneda: string;
  facturas: FacturaCobroCandidata[];
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

export function usePagoClienteLoteState(a: Args) {
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const registrar = usePagoClienteLote();

  const saldoTotal = useMemo(
    () => round2(a.facturas.reduce((s, f) => s + Number(f.saldo || 0), 0)),
    [a.facturas],
  );

  const [fecha, setFecha] = useState(todayLocalISO());
  const [total, setTotal] = useState("");
  const [formaPago, setFormaPago] = useState("03");
  const [referencia, setReferencia] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [notas, setNotas] = useState("");
  const [renglones, setRenglones] = useState<RenglonCobro[]>([]);

  // Al abrir: importe sugerido = saldo total, reparto FIFO por vencimiento.
  useEffect(() => {
    if (!a.open) return;
    setFecha(todayLocalISO());
    setTotal(String(saldoTotal));
    setFormaPago("03");
    setReferencia("");
    setCuentaId("");
    setNotas("");
    setRenglones(repartirFifo(a.facturas, saldoTotal).renglones);
  }, [a.open, a.facturas, saldoTotal]);

  // Aviso previo: cuáles de las facturas candidatas exigirán REP (PPD timbradas).
  const [idsConRep, setIdsConRep] = useState<string[]>([]);
  useEffect(() => {
    if (!a.open) return;
    let vivo = true;
    const ids = a.facturas.map((f) => f.factura_id);
    obtenerFacturasConRep(ids)
      .then((res) => {
        if (vivo) setIdsConRep(res);
      })
      .catch(() => {
        if (vivo) setIdsConRep([]);
      });
    return () => {
      vivo = false;
    };
  }, [a.open, a.facturas]);


  const esExtranjera = a.moneda !== "MXN";
  const pedirTc = a.open && esExtranjera;
  const { data: tcDofRaw } = useTcDofPorFecha(pedirTc ? fecha : null, pedirTc);
  const tcDof = esExtranjera ? tcDofRaw ?? null : null;

  const totalNum = round2(Number(total) || 0);
  const cuentasMoneda = cuentas.filter((c) => c.moneda === a.moneda);
  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? null;

  const { error, totalRepartido } = validarCobroLote(a.facturas, renglones, totalNum, {
    cuentaId: cuentaId || null,
    monedaCuenta: cuenta?.moneda ?? null,
    moneda: a.moneda,
  });
  const sinAsignar = round2(totalNum - totalRepartido);
  const repRequeridos = renglones.filter(
    (r) => r.monto > 0 && idsConRep.includes(r.factura_id),
  ).length;

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
    const aplicadas = renglones.filter((r) => r.monto > 0).map((r) => r.factura_id);
    await registrar.mutateAsync({
      cliente_id: a.clienteId,
      fecha_pago: fecha,
      moneda: a.moneda,
      forma_pago: formaPago,
      referencia,
      cuenta_bancaria_id: cuentaId || null,
      tipo_cambio_usd: tcDof?.usdMxn ?? null,
      notas,
      renglones,
      facturasConRep: await obtenerFacturasConRep(aplicadas),
    });
    a.onOpenChange(false);
    a.onDone();
  };

  return {
    fecha, setFecha, total, formaPago, setFormaPago, referencia, setReferencia,
    cuentaId, setCuentaId, notas, setNotas, renglones,
    saldoTotal, tcDof, cuentasMoneda,
    error, sinAsignar, totalRepartido, repRequeridos, recalcular, setMonto, submit,
    guardando: registrar.isPending,
  };
}
