/**
 * Controller de la tab "Proyección" de Facturación.
 * Encapsula selección de mes (sincronizada con URL ?mes=YYYY-MM), filtros,
 * fetch del backend, KPIs y export a CSV.
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useOrgFilter } from "@/hooks/shared";
import { fetchProyeccionMes } from "@/features/facturacion/services";
import {
  agruparPorExpediente,
  calcularKpisProyeccion,
  generarMesesDisponibles,
  mesActualKey,
  type EstadoProyeccion,
} from "@/features/facturacion/domain/proyeccionFacturacion";
import { exportToCsv } from "@/generators/exportCsv";
import {
  PROYECCION_CSV_HEADERS,
  buildProyeccionCsvFilename,
  buildProyeccionCsvRows,
} from "@/features/facturacion/domain/proyeccionCsv";
import { queryKeys } from "@/lib/query";

type FiltroEstado = "todos" | EstadoProyeccion;

export function useTabProyeccionController() {
  const { organizationId } = useOrgFilter();
  const [searchParams, setSearchParams] = useSearchParams();

  const mesesDisponibles = useMemo(() => generarMesesDisponibles(), []);
  const mesQp = searchParams.get("mes");
  const mesValido = mesesDisponibles.find((m) => m.key === mesQp);
  const [mesKey, setMesKeyState] = useState<string>(mesValido?.key ?? mesActualKey());

  const setMesKey = useCallback(
    (key: string) => {
      setMesKeyState(key);
      const next = new URLSearchParams(searchParams);
      next.set("mes", key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const mesActual = useMemo(
    () => mesesDisponibles.find((m) => m.key === mesKey) ?? mesesDisponibles[mesesDisponibles.length - 1],
    [mesesDisponibles, mesKey],
  );

  const indiceMes = mesesDisponibles.findIndex((m) => m.key === mesActual.key);
  const irMesAnterior = useCallback(() => {
    if (indiceMes > 0) setMesKey(mesesDisponibles[indiceMes - 1].key);
  }, [indiceMes, mesesDisponibles, setMesKey]);
  const irMesSiguiente = useCallback(() => {
    if (indiceMes < mesesDisponibles.length - 1) setMesKey(mesesDisponibles[indiceMes + 1].key);
  }, [indiceMes, mesesDisponibles, setMesKey]);

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroOperador, setFiltroOperador] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const { data: filas = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.facturacion.proyeccion(organizationId, mesActual.key),
    queryFn: () =>
      fetchProyeccionMes({
        organizationId: organizationId ?? null,
        year: mesActual.year,
        month: mesActual.month,
      }),
    staleTime: 60_000,
  });

  const grupos = useMemo(() => agruparPorExpediente(filas), [filas]);

  const clientesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const g of grupos) if (g.cliente_nombre) set.add(g.cliente_nombre);
    return Array.from(set).sort();
  }, [grupos]);

  const operadoresDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const g of grupos) if (g.operador) set.add(g.operador);
    return Array.from(set).sort();
  }, [grupos]);

  const gruposFiltrados = useMemo(() => {
    return grupos.filter((g) => {
      if (filtroCliente !== "todos" && g.cliente_nombre !== filtroCliente) return false;
      if (filtroOperador !== "todos" && g.operador !== filtroOperador) return false;
      if (filtroEstado !== "todos" && g.estado !== filtroEstado) return false;
      return true;
    });
  }, [grupos, filtroCliente, filtroOperador, filtroEstado]);

  const kpis = useMemo(() => calcularKpisProyeccion(gruposFiltrados), [gruposFiltrados]);
  const kpisGlobales = useMemo(() => calcularKpisProyeccion(grupos), [grupos]);

  const exportarCsv = useCallback(() => {
    exportToCsv(
      buildProyeccionCsvFilename(mesActual.key),
      PROYECCION_CSV_HEADERS,
      buildProyeccionCsvRows(gruposFiltrados),
    );
  }, [gruposFiltrados, mesActual.key]);

  return {
    // mes
    mesActual,
    mesesDisponibles,
    setMesKey,
    irMesAnterior,
    irMesSiguiente,
    puedeIrAtras: indiceMes > 0,
    puedeIrAdelante: indiceMes < mesesDisponibles.length - 1,
    // filtros
    filtroCliente, setFiltroCliente,
    filtroOperador, setFiltroOperador,
    filtroEstado, setFiltroEstado,
    clientesDisponibles, operadoresDisponibles,
    // datos
    isLoading,
    grupos: gruposFiltrados,
    kpis,
    kpisGlobales,
    // acciones
    exportarCsv,
  };
}
