/**
 * Estado, validación y envío del cobro en lote de cliente.
 * Mantiene el diálogo bajo el límite de complejidad y de líneas.
 */
import { errorRenglonPue } from "../services/cobroLoteValidaciones";
import { errorCobroPuePrevio } from "../domain/pueCobroPrevio";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useIdsConRep, useTcLote,
} from "@/features/facturacion/hooks/pagoClienteLoteHelpers";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
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

export function usePagoClienteLoteState(a: Args) {
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const registrar = usePagoClienteLote();
  const abiertoRef = useRef(a.open);
  useEffect(() => { abiertoRef.current = a.open; return () => { abiertoRef.current = false; }; }, [a.open]);
  const facturasActuales = useRef(a.facturas);
  useEffect(() => { facturasActuales.current = a.facturas; }, [a.facturas]);

  const saldoTotal = useMemo(
    () => round2(a.facturas.filter((f) => !errorCobroPuePrevio(f)).reduce((s, f) => s + Number(f.saldo || 0), 0)),
    [a.facturas],
  );

  const [fecha, setFecha] = useState(todayLocalISO());
  const [total, setTotal] = useState("");
  const [formaPago, setFormaPago] = useState("03");
  const [referencia, setReferencia] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [notas, setNotas] = useState("");
  const [renglones, setRenglones] = useState<RenglonCobro[]>([]);
  // El FIFO precargado no es captura; comparar contra esta apertura evita
  // avisos vacíos y conserva la referencia aunque cambie la lista por refetch.
  const capturaInicial = useRef<string | null>(null);
  // La preparación previa también forma parte del envío y debe bloquear cierre.
  const envioEnCurso = useRef(false);
  const [preparando, setPreparando] = useState(false);
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
    const fechaInicial = todayLocalISO();
    const totalInicial = String(saldoTotal);
    const repartoInicial = repartirFifo(a.facturas, saldoTotal).renglones;
    capturaInicial.current = JSON.stringify([fechaInicial, totalInicial, "03", "", "", "", repartoInicial]);
    setFecha(fechaInicial);
    setTotal(totalInicial);
    setFormaPago("03");
    setReferencia("");
    setCuentaId("");
    setNotas("");
    setRenglones(repartoInicial);
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
    formaPago,
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
    const f = a.facturas.find((x) => x.factura_id === facturaId);
    if (monto > 0 && f && errorCobroPuePrevio(f)) return;
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
    if (error || !abiertoRef.current || envioEnCurso.current || registrar.isPending) return;
    envioEnCurso.current = true;
    setPreparando(true);
    const aplicadas = renglones.filter((r) => r.monto > 0).map((r) => r.factura_id);
    try {
      const facturasConRep = await obtenerFacturasConRep(aplicadas);
      if (!abiertoRef.current || errorRenglonPue(facturasActuales.current, renglones)) return;
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
        facturasConRep,
      });
    } catch {
      // RFE-08 (Ola 12): el onError del mutation ya notificó con
      // traducirErrorCobroLote + notifyError; aquí sólo se cierra el rechazo
      // de promesa no manejado y el diálogo queda abierto para reintentar
      // (la RPC deduplica por request_id — RNF-01).
      return;
    } finally {
      envioEnCurso.current = false;
      setPreparando(false);
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
    isDirty: capturaInicial.current !== null && capturaInicial.current !==
      JSON.stringify([fecha, total, formaPago, referencia, cuentaId, notas, renglones]),
    guardando: preparando || registrar.isPending,
  };

}
