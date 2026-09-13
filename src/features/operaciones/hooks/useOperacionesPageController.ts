import { useMemo, useState } from "react";
import { formatFechaLarga } from "@/lib/formatters/dates";
import {
  useOperacionesData,
  MAX_CONTENEDORES,
} from "@/features/operaciones/hooks/useOperacionesData";

/**
 * Controller de la página /operaciones.
 * Centraliza el estado de filtros (operador del chart) y los derivados
 * visuales (chartData, balance, porcentaje de contenedores, total de alertas,
 * fecha localizada).
 *
 * R221: se retiró el filtro de periodo. `operaciones_stats()` siempre agrega el
 * mismo periodo fijo, así que el selector no cambiaba ningún número (era un
 * no-op que engañaba al usuario). Si se quiere el filtro real hay que pasarlo
 * al RPC; queda como tarea propia.
 */
export function useOperacionesPageController() {
  const [operadorChart, setOperadorChart] = useState<string>("todos");
  const { isLoading, isError, refetch, operadores, global } = useOperacionesData();

  const hoyStr = useMemo(() => {
    return formatFechaLarga(new Date());
  }, []);

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
    isError,
    refetch,
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
