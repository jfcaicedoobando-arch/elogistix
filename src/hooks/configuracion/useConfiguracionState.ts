import { useState, useEffect } from "react";
import { useConfiguracion, useUpdateConfiguracion, type ConfigItem } from "./useConfiguracion";

export function getVal<T>(data: ConfigItem[] | undefined, categoria: string, clave: string, fallback: T): T {
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  return item ? (item.valor as T) : fallback;
}

export interface ConfigState {
  nombre: string;
  subtitulo: string;
  rfc: string;
  direccion: string;
  email: string;
  telefono: string;
  usdMxn: string;
  eurMxn: string;
  fuente: string;
  vigenciaDias: string;
  diasLibres: string;
  monedaCot: string;
  terminos: string;
  tasaIva: string;
  diasVenc: string;
  serieFact: string;
  folioInicial: string;
  monedaFact: string;
  prefijo: string;
  tipoCargaDefault: string;
  monedaEmb: string;
  diasEta: string;
  diasEtaCritica: string;
  diasFactVencer: string;
}

export function buildStateFromConfig(config: ConfigItem[] | undefined): ConfigState {
  return {
    nombre: getVal(config, "empresa", "nombre", ""),
    subtitulo: getVal(config, "empresa", "subtitulo", ""),
    rfc: getVal(config, "empresa", "rfc", ""),
    direccion: getVal(config, "empresa", "direccion_fiscal", ""),
    email: getVal(config, "empresa", "email", ""),
    telefono: getVal(config, "empresa", "telefono", ""),
    usdMxn: String(getVal(config, "tipos_cambio", "usd_mxn_default", 17.25)),
    eurMxn: String(getVal(config, "tipos_cambio", "eur_mxn_default", 18.5)),
    fuente: getVal(config, "tipos_cambio", "fuente", "api"),
    vigenciaDias: String(getVal(config, "cotizaciones", "vigencia_dias", 15)),
    diasLibres: String(getVal(config, "cotizaciones", "dias_libres_destino", 0)),
    monedaCot: getVal(config, "cotizaciones", "moneda_default", "USD"),
    terminos: getVal(config, "cotizaciones", "terminos_condiciones", ""),
    tasaIva: String(getVal(config, "facturacion", "tasa_iva", 16)),
    diasVenc: String(getVal(config, "facturacion", "dias_vencimiento", 30)),
    serieFact: getVal(config, "facturacion", "serie_factura", "A"),
    folioInicial: String(getVal(config, "facturacion", "folio_inicial", 1)),
    monedaFact: getVal(config, "facturacion", "moneda_default", "MXN"),
    prefijo: getVal(config, "embarques", "prefijo_expediente", "EXP"),
    tipoCargaDefault: getVal(config, "embarques", "tipo_carga_default", "Carga General"),
    monedaEmb: getVal(config, "embarques", "moneda_default", "USD"),
    diasEta: String(getVal(config, "alertas", "dias_eta_alerta", 7)),
    diasEtaCritica: String(getVal(config, "alertas", "dias_eta_critica", 3)),
    diasFactVencer: String(getVal(config, "alertas", "dias_factura_vencer", 7)),
  };
}

const INITIAL_STATE: ConfigState = buildStateFromConfig(undefined);

export function useConfiguracionState() {
  const { data: config, isLoading } = useConfiguracion();
  const updateConfig = useUpdateConfiguracion();
  const [s, setS] = useState<ConfigState>(INITIAL_STATE);

  useEffect(() => {
    if (config) setS(buildStateFromConfig(config));
  }, [config]);

  const set = <K extends keyof ConfigState>(key: K) => (value: ConfigState[K]) =>
    setS(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateConfig.mutate([
      { categoria: "empresa", clave: "nombre", valor: s.nombre },
      { categoria: "empresa", clave: "subtitulo", valor: s.subtitulo },
      { categoria: "empresa", clave: "rfc", valor: s.rfc },
      { categoria: "empresa", clave: "direccion_fiscal", valor: s.direccion },
      { categoria: "empresa", clave: "email", valor: s.email },
      { categoria: "empresa", clave: "telefono", valor: s.telefono },
      { categoria: "tipos_cambio", clave: "usd_mxn_default", valor: parseFloat(s.usdMxn) || 17.25 },
      { categoria: "tipos_cambio", clave: "eur_mxn_default", valor: parseFloat(s.eurMxn) || 18.5 },
      { categoria: "tipos_cambio", clave: "fuente", valor: s.fuente },
      { categoria: "cotizaciones", clave: "vigencia_dias", valor: parseInt(s.vigenciaDias) || 15 },
      { categoria: "cotizaciones", clave: "dias_libres_destino", valor: parseInt(s.diasLibres) || 0 },
      { categoria: "cotizaciones", clave: "moneda_default", valor: s.monedaCot },
      { categoria: "cotizaciones", clave: "terminos_condiciones", valor: s.terminos },
      { categoria: "facturacion", clave: "tasa_iva", valor: parseInt(s.tasaIva) || 16 },
      { categoria: "facturacion", clave: "dias_vencimiento", valor: parseInt(s.diasVenc) || 30 },
      { categoria: "facturacion", clave: "serie_factura", valor: s.serieFact },
      { categoria: "facturacion", clave: "folio_inicial", valor: parseInt(s.folioInicial) || 1 },
      { categoria: "facturacion", clave: "moneda_default", valor: s.monedaFact },
      { categoria: "embarques", clave: "prefijo_expediente", valor: s.prefijo },
      { categoria: "embarques", clave: "tipo_carga_default", valor: s.tipoCargaDefault },
      { categoria: "embarques", clave: "moneda_default", valor: s.monedaEmb },
      { categoria: "alertas", clave: "dias_eta_alerta", valor: parseInt(s.diasEta) || 7 },
      { categoria: "alertas", clave: "dias_eta_critica", valor: parseInt(s.diasEtaCritica) || 3 },
      { categoria: "alertas", clave: "dias_factura_vencer", valor: parseInt(s.diasFactVencer) || 7 },
    ]);
  };

  return { s, set, isLoading, isSaving: updateConfig.isPending, handleSave };
}
