/**
 * Estado local de la vista Estado de Cuenta: rango, filtros, búsqueda,
 * bucket de antigüedad, orden y paginación progresiva. Deja al componente
 * como pura presentación (Power of 10).
 */
import { useMemo, useState } from "react";
import { useEstadoCuenta } from "./useEstadoCuenta";
import { useEstadoCuentaDateRange } from "./useEstadoCuentaDateRange";
import {
  agruparPorMoneda,
  bucketDeFactura,
  calcularAging,
  type BucketAging,
  type OrdenEstadoCuenta,
  type SortEstadoCuenta,
} from "../services/estadoCuentaAging";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

const PAGINA = 25;

function coincideBusqueda(f: FacturaEstadoCuenta, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return (
    (f.numero ?? "").toLowerCase().includes(needle) ||
    (f.expediente ?? "").toLowerCase().includes(needle)
  );
}

export function useEstadoCuentaVista(clienteIds: string[], defaultSoloConSaldo: boolean) {
  const { desde, hasta, presetActivo, aplicarPreset } = useEstadoCuentaDateRange("30d");
  const [soloConSaldo, setSoloConSaldo] = useState(defaultSoloConSaldo);
  const [moneda, setMoneda] = useState<"MXN" | "USD" | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");
  const [bucket, setBucket] = useState<BucketAging | null>(null);
  const [sort, setSort] = useState<SortEstadoCuenta>({ key: "fecha", dir: "desc" });
  const [visibles, setVisibles] = useState(PAGINA);

  const filters = useMemo(
    () => ({ clienteIds, desde, hasta, moneda, soloConSaldo }),
    [clienteIds, desde, hasta, moneda, soloConSaldo],
  );

  const { rows, kpis, isLoading } = useEstadoCuenta(filters);

  const aging = useMemo(() => calcularAging(rows), [rows]);

  const filtradas = useMemo(
    () =>
      rows.filter(
        (f) =>
          coincideBusqueda(f, busqueda) &&
          (bucket === null || (f.saldo > 0.01 && bucketDeFactura(f.dias_vencido) === bucket)),
      ),
    [rows, busqueda, bucket],
  );

  const grupos = useMemo(
    () => agruparPorMoneda(filtradas.slice(0, visibles), sort),
    [filtradas, visibles, sort],
  );

  const onSort = (key: OrdenEstadoCuenta) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  const toggleBucket = (b: BucketAging) => {
    setBucket((prev) => (prev === b ? null : b));
    setVisibles(PAGINA);
  };

  return {
    desde, hasta, presetActivo, aplicarPreset,
    soloConSaldo, setSoloConSaldo,
    moneda, setMoneda,
    busqueda, setBusqueda,
    bucket, toggleBucket,
    sort, onSort,
    rows, filtradas, grupos, aging, kpis, isLoading,
    restantes: Math.max(0, filtradas.length - visibles),
    verMas: () => setVisibles((v) => v + PAGINA),
  };
}
