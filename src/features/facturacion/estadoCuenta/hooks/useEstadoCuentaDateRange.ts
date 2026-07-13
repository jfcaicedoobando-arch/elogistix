/**
 * Rango de fecha para Estado de Cuenta con presets (Últimos 30d, Este mes,
 * Trimestre, Este año, Histórico). Se sincroniza a querystring `?desde=&hasta=`
 * siguiendo el patrón de `useFacturacionDateRange`.
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type PresetRango = "30d" | "mes" | "trimestre" | "anio" | "historico";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(v: string | null): string | null {
  return v && ISO_DATE.test(v) ? v : null;
}

export function rangoDePreset(preset: PresetRango): { desde: string | null; hasta: string | null } {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (preset === "historico") return { desde: null, hasta: null };
  if (preset === "30d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 30);
    return { desde: toIso(d), hasta: toIso(hoy) };
  }
  if (preset === "mes") {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: toIso(d), hasta: toIso(hoy) };
  }
  if (preset === "trimestre") {
    const q = Math.floor(hoy.getMonth() / 3) * 3;
    const d = new Date(hoy.getFullYear(), q, 1);
    return { desde: toIso(d), hasta: toIso(hoy) };
  }
  // anio
  const d = new Date(hoy.getFullYear(), 0, 1);
  return { desde: toIso(d), hasta: toIso(hoy) };
}

export function useEstadoCuentaDateRange(defaultPreset: PresetRango = "30d") {
  const [params, setParams] = useSearchParams();
  const desde = parseIso(params.get("desde"));
  const hasta = parseIso(params.get("hasta"));
  const presetActivo = (params.get("preset") as PresetRango | null) ?? null;

  const isDefault = !desde && !hasta && !presetActivo;
  const efectivo = useMemo(() => {
    if (isDefault) return rangoDePreset(defaultPreset);
    return { desde, hasta };
  }, [isDefault, defaultPreset, desde, hasta]);

  const aplicarPreset = useCallback(
    (preset: PresetRango) => {
      const r = rangoDePreset(preset);
      const next = new URLSearchParams(params);
      next.set("preset", preset);
      if (r.desde) next.set("desde", r.desde); else next.delete("desde");
      if (r.hasta) next.set("hasta", r.hasta); else next.delete("hasta");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const limpiar = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("desde");
    next.delete("hasta");
    next.delete("preset");
    setParams(next, { replace: true });
  }, [params, setParams]);

  return {
    desde: efectivo.desde,
    hasta: efectivo.hasta,
    presetActivo: presetActivo ?? (isDefault ? defaultPreset : null),
    aplicarPreset,
    limpiar,
  };
}
