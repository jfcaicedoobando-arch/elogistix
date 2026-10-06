import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchTcDofPorFecha, type TcDofVigente } from "@/features/catalogos/services/tipoCambioDof";
import { queryKeys } from "@/lib/query";
import { monedaExtranjeraDelPar } from "../components/ncMonedaProveedor";
import type { MonedaNotaCreditoProveedor } from "../types";

interface Opciones {
  open: boolean;
  fecha: string;
  moneda: MonedaNotaCreditoProveedor;
  monedaFactura: MonedaNotaCreditoProveedor;
  tipoCambio: string;
}

export interface TipoCambioNcProveedor {
  tipoCambio: number | null;
  disponible: boolean;
  fuente: "manual" | "dof" | null;
  fechaDof: string | null;
  aviso: string | null;
}

const sinCambio = { tipoCambio: null, fuente: null, fechaDof: null };

function resolverManual(tipoCambio: string): TipoCambioNcProveedor {
  const tc = Number(tipoCambio);
  if (Number.isFinite(tc) && tc > 0) {
    return { tipoCambio: tc, disponible: true, fuente: "manual", fechaDof: null, aviso: null };
  }
  return { ...sinCambio, disponible: false, aviso: "El tipo de cambio debe ser un número positivo." };
}

function resolverDof(
  dof: Pick<UseQueryResult<TcDofVigente | null>, "data" | "isError" | "isPending">,
  extranjera: MonedaNotaCreditoProveedor,
): TipoCambioNcProveedor {
  if (dof.isError) {
    return { ...sinCambio, disponible: false, aviso: "No se pudo consultar el DOF. Captura un tipo de cambio válido o vuelve a intentar." };
  }
  if (dof.isPending) {
    return { ...sinCambio, disponible: false, aviso: "Consultando el tipo de cambio DOF para la fecha de la NC…" };
  }
  const tc = extranjera === "USD" ? dof.data?.usdMxn : dof.data?.eurMxn;
  if (tc == null || !Number.isFinite(tc) || tc <= 0) {
    return { ...sinCambio, disponible: false, aviso: "No hay tipo de cambio DOF disponible. Captura un tipo de cambio válido." };
  }
  return { tipoCambio: tc, disponible: true, fuente: "dof", fechaDof: dof.data?.fecha ?? null, aviso: null };
}

/** El mismo TC mostrado se envía al guardar: sólo el campo vacío consulta DOF. */
export function useNcProveedorTipoCambio(opciones: Opciones): TipoCambioNcProveedor {
  const { open, fecha, moneda, monedaFactura, tipoCambio } = opciones;
  const extranjera = moneda === monedaFactura && moneda !== "MXN"
    ? moneda : monedaExtranjeraDelPar(moneda, monedaFactura);
  const manual = tipoCambio.trim() !== "";
  const dof = useQuery({
    queryKey: queryKeys.exchangeRates.dofFecha(fecha),
    queryFn: () => fetchTcDofPorFecha(fecha),
    enabled: open && !!fecha && extranjera !== null && !manual,
    staleTime: 30_000,
  });
  if (moneda === "MXN" && monedaFactura === "MXN") return { ...sinCambio, disponible: true, aviso: null };
  if (!extranjera) return { ...sinCambio, disponible: false, aviso: null };
  return manual ? resolverManual(tipoCambio) : resolverDof(dof, extranjera);
}
