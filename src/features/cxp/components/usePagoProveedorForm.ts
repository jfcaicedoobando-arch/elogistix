/**
 * Estado y validación para DialogRegistrarPagoProveedor.
 * Extraído v12.95.23 para mantener el dialog ≤200 LOC.
 */
import { useEffect, useMemo, useState } from "react";
import type { FacturaCxP } from "@/features/cxp/services";
import type { Database } from "@/integrations/supabase/types";
import { defaultMetodo, metodosFor } from "./pagoProveedorHelpers";
import { todayLocalISO } from "@/lib/date/today";

type Moneda = Database["public"]["Enums"]["moneda"];

export function usePagoProveedorForm(factura: FacturaCxP | null, open: boolean) {
  const today = todayLocalISO();

  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("MXN");
  const [tc, setTc] = useState("");
  const [metodo, setMetodo] = useState<string>("Transferencia");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [diffMxn, setDiffMxn] = useState<string>("");

  useEffect(() => {
    if (!factura || !open) return;
    setFecha(today);
    setMonto(factura.saldo.toFixed(2));
    setMoneda(factura.moneda);
    setTc(factura.tipo_cambio_usd ? String(factura.tipo_cambio_usd) : "");
    setMetodo(defaultMetodo(factura.proveedor_origen));
    setReferencia("");
    setNotas("");
    setDiffMxn("");
  }, [factura, open, today]);

  const metodosDisponibles = useMemo(
    () => metodosFor(factura?.proveedor_origen ?? null),
    [factura?.proveedor_origen],
  );

  const montoNum = Number(monto) || 0;
  const saldoRestante = useMemo(
    () => Math.max(0, (factura?.saldo ?? 0) - montoNum),
    [factura, montoNum],
  );
  const esUsdPagadoEnMxn = factura?.moneda === "USD" && moneda === "MXN";
  const showTc = moneda !== "MXN";
  const excede = factura ? montoNum > factura.saldo + 0.01 : false;

  return {
    fecha, setFecha, monto, setMonto, moneda, setMoneda,
    tc, setTc, metodo, setMetodo, referencia, setReferencia,
    notas, setNotas, diffMxn, setDiffMxn,
    metodosDisponibles, montoNum, saldoRestante,
    esUsdPagadoEnMxn, showTc, excede,
  };
}
