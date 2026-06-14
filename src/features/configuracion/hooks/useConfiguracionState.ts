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
 *   - facturacion.tasa_iva → leído por `useTasaIVA` en cotización/proforma/factura
 *
 * Los campos legacy (tipos_cambio, defaults de cotizaciones/embarques, alertas,
 * umbrales de auditoría) se removieron de la UI en 12.51.18 porque ningún
 * consumidor los leía. Las filas históricas en la tabla `configuracion` se
 * mantienen por compatibilidad y se purgarán en una migración separada si
 * se confirma que no se cablearán a futuro.
 */
export interface ConfigState {
  nombre: string;
  subtitulo: string;
  rfc: string;
  direccion: string;
  email: string;
  telefono: string;
  tasaIva: string;
}

export function buildStateFromConfig(config: ConfigItem[] | undefined): ConfigState {
  return {
    nombre: getVal(config, "empresa", "nombre", ""),
    subtitulo: getVal(config, "empresa", "subtitulo", ""),
    rfc: getVal(config, "empresa", "rfc", ""),
    direccion: getVal(config, "empresa", "direccion_fiscal", ""),
    email: getVal(config, "empresa", "email", ""),
    telefono: getVal(config, "empresa", "telefono", ""),
    tasaIva: String(getVal(config, "facturacion", "tasa_iva", 16)),
  };
}

const INITIAL_STATE: ConfigState = buildStateFromConfig(undefined);

export function useConfiguracionState() {
  const { data: config, isLoading } = useConfiguracion();
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
      { categoria: "facturacion", clave: "tasa_iva", valor: parseInt(s.tasaIva) || 16 },
    ], {
      onSuccess: () => setBaseline(s),
    });
  };

  return { s, set, isLoading, isSaving: updateConfig.isPending, isDirty, handleSave };
}
