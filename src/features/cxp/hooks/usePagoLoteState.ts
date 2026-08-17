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

/**
 * RTC-01: T/C del lote extraído del hook principal para respetar el límite de
 * complejidad. Política: DOF de la fecha de pago, en la moneda del lote (espejo
 * de `useTcLote` en CxC). Sin T/C disponible el envío se bloquea.
 */
function useTcLotePago(open: boolean, moneda: string, fecha: string) {
  const esExtranjera = moneda !== "MXN";
  const pedirTc = open && esExtranjera;
  const { data: tcDofRaw } = useTcDofPorFecha(pedirTc ? fecha : null, pedirTc);
  const tcDof = esExtranjera ? tcDofRaw ?? null : null;
  const tcAplicable = esExtranjera
    ? (moneda === "EUR" ? tcDof?.eurMxn : tcDof?.usdMxn) ?? null
    : null;
  return { esExtranjera, tcDof, tcAplicable, tcBloqueado: esExtranjera && !tcAplicable };
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
  // BL-02 (espejo RNF-01 de CxC): llave de idempotencia del lote; se
  // regenera al abrir el diálogo para que cada intento de submit sea
  // distinguible y los reintentos del MISMO submit deduplique en servidor.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

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
    setRequestId(crypto.randomUUID());
  }, [a.open, a.facturas, a.proveedorOrigen, saldoTotal]);

  const { tcDof, tcAplicable, tcBloqueado } = useTcLotePago(a.open, a.moneda, fecha);

  const totalNum = round2(Number(total) || 0);
  const cuentasMoneda = cuentas.filter((c) => c.moneda === a.moneda);
  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? null;
  const requiereCuenta = metodo !== "Efectivo";

  const { error: errorLote, totalRepartido } = validarLote(a.facturas, renglones, totalNum, {
    requiereCuenta,
    cuentaId: cuentaId || null,
    monedaCuenta: cuenta?.moneda ?? null,
    moneda: a.moneda,
    fecha,
  });
  const error = tcBloqueado
    ? `Sin tipo de cambio DOF ${a.moneda}/MXN para esta fecha: no se puede registrar el pago en lote.`
    : errorLote;
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
    try {
      await registrar.mutateAsync({
        proveedor_id: a.proveedorId,
        fecha_pago: fecha,
        moneda: a.moneda,
        metodo_pago: metodo,
        referencia,
        cuenta_bancaria_id: cuentaId || null,
        tipo_cambio_usd: tcAplicable,
        notas,
        // Ola 11 · RNF-05 (espejo RG4-5): el importe de la transferencia viaja a
        // la RPC; la validación exacta también vive en la función.
        importe_recibido: totalNum,
        request_id: requestId,
        renglones,
      });
    } catch {
      // RFE-08 (Ola 12): el onError del mutation ya notificó con
      // traducirErrorPagoProveedor + notifyError; aquí sólo se cierra el
      // rechazo de promesa no manejado y el diálogo queda abierto.
      return;
    }
    a.onOpenChange(false);
    a.onDone();
  };

  return {
    fecha, setFecha, total, metodo, setMetodo, referencia, setReferencia,
    cuentaId, setCuentaId, notas, setNotas, renglones,
    saldoTotal, tcDof, tcAplicable, tcBloqueado, cuentasMoneda, requiereCuenta,
    error, sinAsignar, totalRepartido, recalcular, setMonto, submit,
    guardando: registrar.isPending,
  };
}
