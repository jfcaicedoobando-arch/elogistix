/**
 * Hook para sincronizar el rango de fechas (Desde / Hasta) del módulo de
 * Facturación con la URL (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD).
 *
 * Por defecto: mes en curso (día 1 → hoy).
 *
 * Devuelve helpers para mutar el rango y para probar pertenencia de una
 * fecha en formato `YYYY-MM-DD` (o `null`/`undefined`) dentro del rango
 * activo. Si el rango está vacío, `isInRange` siempre devuelve `true`.
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export interface FacturacionDateRange {
  desde: Date | null;
  hasta: Date | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string | null): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function useFacturacionDateRange() {
  const [searchParams, setSearchParams] = useSearchParams();

  const desdeQp = searchParams.get("desde");
  const hastaQp = searchParams.get("hasta");
  const hasQp = desdeQp !== null || hastaQp !== null;

  const range = useMemo<FacturacionDateRange>(() => {
    if (!hasQp) {
      return { desde: startOfMonth(), hasta: new Date() };
    }
    return { desde: parseIsoDate(desdeQp), hasta: parseIsoDate(hastaQp) };
  }, [desdeQp, hastaQp, hasQp]);

  const setRango = useCallback(
    (next: Partial<FacturacionDateRange>) => {
      const merged: FacturacionDateRange = {
        desde: next.desde !== undefined ? next.desde : range.desde,
        hasta: next.hasta !== undefined ? next.hasta : range.hasta,
      };
      const params = new URLSearchParams(searchParams);
      const desdeIso = toIsoDate(merged.desde);
      const hastaIso = toIsoDate(merged.hasta);
      if (desdeIso) params.set("desde", desdeIso); else params.delete("desde");
      if (hastaIso) params.set("hasta", hastaIso); else params.delete("hasta");
      setSearchParams(params, { replace: true });
    },
    [range, searchParams, setSearchParams],
  );

  const limpiar = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("desde");
    params.delete("hasta");
    // Marcador para distinguir "limpio explícito" del default (mes actual).
    params.set("desde", "");
    params.set("hasta", "");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const desdeIso = useMemo(() => toIsoDate(range.desde), [range.desde]);
  const hastaIso = useMemo(() => toIsoDate(range.hasta), [range.hasta]);

  const isInRange = useCallback(
    (fecha: string | null | undefined): boolean => {
      if (!desdeIso && !hastaIso) return true;
      if (!fecha) return false;
      // Comparamos como strings YYYY-MM-DD (orden lexicográfico = orden cronológico).
      const f = fecha.slice(0, 10);
      if (desdeIso && f < desdeIso) return false;
      if (hastaIso && f > hastaIso) return false;
      return true;
    },
    [desdeIso, hastaIso],
  );

  const activo = Boolean(desdeIso || hastaIso);

  return { range, setRango, limpiar, isInRange, activo, desdeIso, hastaIso };
}
