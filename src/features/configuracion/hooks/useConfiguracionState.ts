import { useState, useEffect } from "react";
import { useConfiguracion, useUpdateConfiguracion, type ConfigItem } from "./useConfiguracion";

export function getVal<T>(data: ConfigItem[] | undefined, categoria: string, clave: string, fallback: T): T {
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  return item ? (item.valor as T) : fallback;
}

/**
 * Estado del módulo Configuración. Sólo incluye los campos que actualmente
 * tienen un consumidor real en la app:
 *   - empresa.* → leídos por `fetchEmisorEmpresa` para los encabezados de PDF
 *
 * El campo `facturacion.tasa_iva` se retiró en 13.170.0: el IVA general de
 * México (16%) está hardcodeado en `TASA_IVA` y cada producto del catálogo
 * define su propio tipo de IVA (16% / 0% / Exento).
 */
export interface ConfigState {
  nombre: string;
  subtitulo: string;
  rfc: string;
  direccion: string;
  email: string;
  telefono: string;
}

export function buildStateFromConfig(config: ConfigItem[] | undefined): ConfigState {
  return {
    nombre: getVal(config, "empresa", "nombre", ""),
    subtitulo: getVal(config, "empresa", "subtitulo", ""),
    rfc: getVal(config, "empresa", "rfc", ""),
    direccion: getVal(config, "empresa", "direccion_fiscal", ""),
    email: getVal(config, "empresa", "email", ""),
    telefono: getVal(config, "empresa", "telefono", ""),
  };
}

const INITIAL_STATE: ConfigState = buildStateFromConfig(undefined);

export function useConfiguracionState() {
  const { data: config, isLoading, isError, refetch } = useConfiguracion();
  const updateConfig = useUpdateConfiguracion();
  const [s, setS] = useState<ConfigState>(INITIAL_STATE);
  const [baseline, setBaseline] = useState<ConfigState>(INITIAL_STATE);

  useEffect(() => {
    if (config) {
      const next = buildStateFromConfig(config);
      setS(next);
      setBaseline(next);
    }
  }, [config]);

  const set = <K extends keyof ConfigState>(key: K) => (value: ConfigState[K]) =>
    setS(prev => ({ ...prev, [key]: value }));

  const isDirty = JSON.stringify(s) !== JSON.stringify(baseline);

  const handleSave = () => {
    updateConfig.mutate([
      { categoria: "empresa", clave: "nombre", valor: s.nombre },
      { categoria: "empresa", clave: "subtitulo", valor: s.subtitulo },
      { categoria: "empresa", clave: "rfc", valor: s.rfc },
      { categoria: "empresa", clave: "direccion_fiscal", valor: s.direccion },
      { categoria: "empresa", clave: "email", valor: s.email },
      { categoria: "empresa", clave: "telefono", valor: s.telefono },
    ], {
      onSuccess: () => setBaseline(s),
    });
  };

  return {
    s,
    set,
    isLoading,
    // P1-1: la pantalla necesita distinguir "cargando" de "no se pudo cargar".
    isError,
    refetch: () => void refetch(),
    isSaving: updateConfig.isPending,
    isDirty,
    handleSave,
  };
}
