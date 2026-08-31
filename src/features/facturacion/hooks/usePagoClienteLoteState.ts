/**
 * Estado, validación y envío del cobro en lote de cliente.
 * Mantiene el diálogo bajo el límite de complejidad y de líneas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcDofPorFecha } from "@/features/catalogos/hooks/useTcDofPorFecha";
import { usePagoClienteLote } from "@/features/facturacion/hooks/usePagoClienteLote";
import { todayLocalISO } from "@/lib/date/today";
import {
  erroresPorRenglon,
  obtenerFacturasConRep,
  repartirCero,
  repartirFifo,
  repartirTodo,
  round2,
  validarCobroLote,
  type FacturaCobroCandidata,
  type RenglonCobro,
} from "@/features/facturacion/services/pagoClienteLote";
import {
  asignarSaldoFactura,
  asignarSobrante as asignarSobranteFifo,
} from "@/features/facturacion/services/cobroLoteAtajos";



interface Args {
  open: boolean;
  clienteId: string;
  moneda: string;
  facturas: FacturaCobroCandidata[];
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

/**
 * Aviso previo: cuáles de las facturas candidatas exigirán REP (PPD timbradas).
 * Extraído para mantener baja la complejidad del hook principal.
 */
function useIdsConRep(open: boolean, facturas: FacturaCobroCandidata[]): string[] {
  const [idsConRep, setIdsConRep] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    const ids = facturas.map((f) => f.factura_id);
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
  }, [open, facturas]);
  return idsConRep;
}

/**
 * Ola 5 · RG4-11: el TC que se guarda es el de la MONEDA DEL LOTE.
 * Antes un lote EUR guardaba el TC DOF USD en tipo_cambio_usd.
 */
function useTcLote(open: boolean, moneda: string, fecha: string) {
  const esExtranjera = moneda !== "MXN";
  const pedirTc = open && esExtranjera;
  const { data: tcDofRaw } = useTcDofPorFecha(pedirTc ? fecha : null, pedirTc);
  const tcDof = esExtranjera ? tcDofRaw ?? null : null;
  const porMoneda = moneda === "EUR" ? tcDof?.eurMxn : tcDof?.usdMxn;
  const tcAplicable = esExtranjera ? porMoneda ?? null : null;
  return { tcDof, tcAplicable };
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
  // Ola 11 · RNF-01: una llave por apertura del diálogo; los reintentos del
  // mismo submit (timeout ambiguo, doble clic) la reutilizan y la RPC los
  // deduplica server-side.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  // Ola v16 (3): inicializar UNA sola vez por apertura (mismo patrón que
  // DialogRegistrarPago · FE-02). Antes cualquier refetch de `a.facturas`
  // reconstruía el arreglo, re-ejecutaba este efecto, borraba la captura del
  // usuario y regeneraba el `requestId`, rompiendo la idempotencia del
  // reintento tras un timeout ambiguo.
  const inicializadoRef = useRef(false);
  useEffect(() => {
    if (!a.open) {
      inicializadoRef.current = false;
      return;
    }
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    setFecha(todayLocalISO());
    setTotal(String(saldoTotal));
    setFormaPago("03");
    setReferencia("");
    setCuentaId("");
    setNotas("");
    setRenglones(repartirFifo(a.facturas, saldoTotal).renglones);
    setRequestId(crypto.randomUUID());
  }, [a.open, a.facturas, saldoTotal]);

  const idsConRep = useIdsConRep(a.open, a.facturas);
  const { tcDof, tcAplicable } = useTcLote(a.open, a.moneda, fecha);

  const totalNum = round2(Number(total) || 0);
  const cuentasMoneda = cuentas.filter((c) => c.moneda === a.moneda);
  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? null;

  const { error, totalRepartido } = validarCobroLote(a.facturas, renglones, totalNum, {
    cuentaId: cuentaId || null,
    monedaCuenta: cuenta?.moneda ?? null,
    moneda: a.moneda,
    fecha,
    tcAplicable,
  });
  const sinAsignar = round2(totalNum - totalRepartido);
  const erroresRenglon = erroresPorRenglon(a.facturas, renglones);
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

  const repartirFifoAhora = () => recalcular(totalNum);

  const liquidarTodo = () => {
    setTotal(String(saldoTotal));
    setRenglones(repartirTodo(a.facturas));
  };

  const limpiarReparto = () => setRenglones(repartirCero(a.facturas));

  const asignarSobrante = () =>
    setRenglones((prev) => asignarSobranteFifo(a.facturas, prev, sinAsignar));

  const asignarSaldo = (facturaId: string) =>
    setRenglones((prev) => asignarSaldoFactura(a.facturas, prev, facturaId, sinAsignar));


  const submit = async () => {
    if (error) return;
    const aplicadas = renglones.filter((r) => r.monto > 0).map((r) => r.factura_id);
    try {
      await registrar.mutateAsync({
        cliente_id: a.clienteId,
        fecha_pago: fecha,
        moneda: a.moneda,
        forma_pago: formaPago,
        referencia,
        cuenta_bancaria_id: cuentaId || null,
        tipo_cambio_usd: tcAplicable,
        notas,
        // Ola 5 · RG4-5: el importe recibido viaja a la RPC (defensa en
        // profundidad: la validación exacta también vive en la función).
        importe_recibido: totalNum,
        request_id: requestId,
        renglones,
        facturasConRep: await obtenerFacturasConRep(aplicadas),
      });
    } catch {
      // RFE-08 (Ola 12): el onError del mutation ya notificó con
      // traducirErrorCobroLote + notifyError; aquí sólo se cierra el rechazo
      // de promesa no manejado y el diálogo queda abierto para reintentar
      // (la RPC deduplica por request_id — RNF-01).
      return;
    }
    a.onOpenChange(false);
    a.onDone();
  };

  return {
    fecha, setFecha, total, formaPago, setFormaPago, referencia, setReferencia,
    cuentaId, setCuentaId, notas, setNotas, renglones,
    saldoTotal, tcDof, tcAplicable, cuentasMoneda, totalNum, idsConRep,
    error, erroresRenglon, sinAsignar, totalRepartido, repRequeridos,
    recalcular, setMonto, repartirFifoAhora, liquidarTodo, limpiarReparto,
    asignarSobrante, asignarSaldo, submit,
    guardando: registrar.isPending,
  };

}
