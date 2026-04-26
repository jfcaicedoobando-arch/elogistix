import { useMemo, useState } from "react";
import {
  useOperacionesData,
  MAX_CONTENEDORES,
  type PeriodoFiltro,
} from "@/hooks/operaciones/useOperacionesData";

/**
 * Controller de la página /operaciones.
 * Centraliza el estado de filtros (periodo, operador del chart) y los
 * derivados visuales (chartData, balance, porcentaje de contenedores,
 * total de alertas, fecha localizada).
 */
export function useOperacionesPageController() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [operadorChart, setOperadorChart] = useState<string>("todos");
  const { isLoading, operadores, global } = useOperacionesData(periodo);

  const hoyStr = useMemo(
    () =>
      new Date().toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const chartData = useMemo(() => {
    if (operadorChart === "todos") return global.historicoCreadosPorMes;
    const op = operadores.find((o) => o.nombre === operadorChart);
    if (!op) return global.historicoCreadosPorMes;
    return op.historicoCreadosPorMes.map((c, i) => ({
      mes: c.mes,
      creadas: c.valor,
      llegadas: op.historicoLlegadosPorMes[i]?.valor || 0,
    }));
  }, [operadorChart, operadores, global]);

  const creadasEsteMes =
    operadorChart === "todos"
      ? global.creadasEsteMes
      : operadores.find((o) => o.nombre === operadorChart)?.cargasEsteMes ?? 0;

  const llegadasEsteMes = useMemo(() => {
    if (operadorChart === "todos") return global.llegadasEsteMes;
    const op = operadores.find((o) => o.nombre === operadorChart);
    if (!op) return 0;
    const last = op.historicoLlegadosPorMes[op.historicoLlegadosPorMes.length - 1];
    return last?.valor || 0;
  }, [operadorChart, operadores, global]);

  const balancePct =
    creadasEsteMes > 0 ? Math.round((llegadasEsteMes / creadasEsteMes) * 100) : 100;

  const contPct =
    global.totalContenedores > 0
      ? Math.round((global.totalContenedores / MAX_CONTENEDORES) * 100)
      : 0;

  const totalAlertas = global.totalCriticos + global.totalEnPuerto;

  return {
    periodo,
    setPeriodo,
    operadorChart,
    setOperadorChart,
    isLoading,
    operadores,
    global,
    hoyStr,
    chartData,
    creadasEsteMes,
    llegadasEsteMes,
    balancePct,
    contPct,
    totalAlertas,
  };
}
