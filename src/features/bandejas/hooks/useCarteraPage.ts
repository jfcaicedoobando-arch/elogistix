import { useMemo } from "react";
import { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";
import { resumirCartera, matchesUrgencia, type UrgenciaCartera } from "@/features/bandejas/domain/aggregates";
import { equivalenteMxn } from "@/features/bandejas/domain/carteraFx";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { buildCarteraColumns, type CarteraRow } from "@/features/bandejas/routes/_sections/carteraColumns";

export interface CarteraFilters extends Record<string, string> {
  moneda: string;
  urgencia: string;
}

export const DEFAULT_FILTERS: CarteraFilters = { moneda: "todas", urgencia: "accionable" };

export function useCarteraPage(onRecordatorio?: (row: CarteraRow) => void) {
  const { data = [], isLoading } = useCarteraPendiente();
  const { data: rates } = useExchangeRates();
  const tcUsdMxn = rates?.usdMxn ?? 0;

  const monedas = useMemo(
    () => Array.from(new Set(data.map((r) => r.moneda).filter(Boolean))).sort(),
    [data],
  );

  const paged = useClientPagedList<CarteraRow, CarteraFilters>({
    data,
    isLoading,
    defaultFilters: DEFAULT_FILTERS,
    filterLabels: { moneda: "Moneda", urgencia: "Urgencia" },
    defaultSort: { key: "dias", dir: "desc" },
    searchAccessor: (r) =>
      `${r.numero ?? ""} ${r.cliente_nombre ?? ""} ${r.expediente ?? ""}`,
    filterPredicate: (r, ff) => {
      if (ff.moneda !== "todas" && r.moneda !== ff.moneda) return false;
      if (!matchesUrgencia(r.dias_vencido, ff.urgencia as UrgenciaCartera)) return false;
      return true;
    },
    dateAccessor: (r) => r.fecha_vencimiento,
    sorters: {
      numero: (a, b) => (a.numero ?? "").localeCompare(b.numero ?? ""),
      cliente: (a, b) => (a.cliente_nombre ?? "").localeCompare(b.cliente_nombre ?? ""),
      vencimiento: (a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""),
      dias: (a, b) => a.dias_vencido - b.dias_vencido,
      total: (a, b) => Number(a.total) - Number(b.total),
      saldo: (a, b) => Number(a.saldo) - Number(b.saldo),
    },
  });

  // KPIs sobre el subconjunto filtrado por urgencia + moneda (ignora búsqueda/rango
  // de fechas: los cards resumen "lo que muestra el módulo con estos filtros").
  const scoped = useMemo(
    () =>
      data.filter(
        (r) =>
          matchesUrgencia(r.dias_vencido, (paged.filters.urgencia ?? "accionable") as UrgenciaCartera) &&
          (paged.filters.moneda === "todas" || r.moneda === paged.filters.moneda),
      ),
    [data, paged.filters.urgencia, paged.filters.moneda],
  );
  const { saldosNativos, vencidasCount, vencidoNativo } = resumirCartera(scoped);
  const eqTotal = equivalenteMxn(saldosNativos, tcUsdMxn);
  const eqVencido = equivalenteMxn(vencidoNativo, tcUsdMxn);
  const columns = useMemo(() => buildCarteraColumns(onRecordatorio), [onRecordatorio]);

  return {
    data,
    isLoading,
    monedas,
    paged,
    scoped,
    saldosNativos,
    vencidasCount,
    vencidoNativo,
    eqTotal,
    eqVencido,
    tcUsdMxn,
    columns,
  };
}
