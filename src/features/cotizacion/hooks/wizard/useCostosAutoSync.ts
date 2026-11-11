/**
 * v13.823.396 · Q2/Q6 — Sincronía de los costos auto-generados del Paso 2.
 *
 * Precarga (comportamiento previo) y además detecta cuándo esas filas quedaron
 * desactualizadas respecto al Paso 1:
 *  - Q2: la tarifa se aplicó con otra cantidad de contenedores (1 → 2 o 2 → 1).
 *  - Q6: cambiaron peso/dimensiones, tarifa W/M, mínimo o consolidador del
 *    bloque "Flete LCL manual" después de la primera precarga.
 *
 * El recálculo es SIEMPRE explícito (el usuario aprieta el botón del aviso) y
 * reemplaza únicamente las filas auto-generadas; las capturadas a mano quedan
 * intactas. Mientras exista desajuste, el Paso 2 no deja avanzar.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { buildCostosLCLManual } from "@/features/cotizacion/domain/buildCostosLCLManual";
import { useProveedoresLite } from "@/features/proveedor/hooks/useProveedores";
import type { TopTarifaRow } from "@/features/costeo/types";
import { CAMPOS_COSTO_TARIFA, useCargaCostosTarifa } from "./useCargaCostosTarifa";
import {
  conservarComoManuales,
  costosAutoDeOtraTarifa,
  esCostoAutoFleteLcl,
  sinCostosAutoTarifa,
  desajusteCantidadTarifa,
  fleteLclDesactualizado,
  reemplazarCostosAutoFleteLcl,
  type DesajusteCostos,
} from "@/features/cotizacion/domain/costosAutoGenerados";
import type { CotizacionFormValues, FilaCostoLocal } from "@/features/cotizacion/types";

interface Args {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
  precargar: boolean;
  /** Reporta el desajuste vigente al wizard (bloquea "Siguiente"). */
  onDesajusteChange?: (d: DesajusteCostos | null) => void;
}

export interface CostosAutoSync {
  tarifa: ReturnType<typeof useTarifaVinculada>["data"];
  mostrarAvisoLclFcl: boolean;
  lclAutoCargado: boolean;
  desajuste: DesajusteCostos | null;
  recalculando: boolean;
  errorCargaTarifa: boolean;
  reintentarCargaTarifa: () => void;
  cargarTarifaElegida: (tarifa: TopTarifaRow) => void;
  recalcular: () => void;
  /** P2-5: conserva como manuales los costos de una tarifa ya no vinculada. */
  conservarManuales: () => void;
}

export function useCostosAutoSync({ filas, setFilas, precargar, onDesajusteChange }: Args): CostosAutoSync {
  const { control, getValues } = useFormContext<CotizacionFormValues>();
  const captura = useWatch({ control, name: CAMPOS_COSTO_TARIFA });
  const [tarifaOrigenId, modo, incoterm, tipoEmbarque, numContenedores] = captura;
  const sinFleteVenta = esIncotermSinFleteVenta(incoterm, modo);
  // Una tarifa retenida como origen Pricing no autoriza generar flete.
  const tarifaId = modo === "Marítimo" && !sinFleteVenta ? tarifaOrigenId : null;
  const [lclFleteManual, dimensionesLCL, pesoKg] = useWatch({
    control, name: ["lclFleteManual", "dimensionesLCL", "pesoKg"],
  });

  const { data: tarifa } = useTarifaVinculada(precargar ? tarifaId : null);
  const { data: proveedores = [] } = useProveedoresLite(precargar && tipoEmbarque === "LCL");
  const markup = useConfigValue<number>("cotizaciones", "markup_default_maritimo", 0.15);
  const { cargar, fase, firmaActual } = useCargaCostosTarifa({ getValues, captura, markup, setFilas });

  const cantidad = Math.max(1, Number(numContenedores) || 1);
  const precargadaRef = useRef<string | null>(null);
  const precargadaLclRef = useRef<boolean>(false);

  // Desajuste tarifa (FCL) ↔ cotización (LCL): `costeo_tarifas` está modelada
  // para contenedor; una tarifa con `tipo_contenedor_nombre` en una cotización
  // LCL genera unidades inconsistentes si no se convierte a m³.
  const mostrarAvisoLclFcl = !!tarifa?.tipo_contenedor_nombre && tipoEmbarque === "LCL";

  /** Filas que hoy produciría el bloque "Flete LCL manual" del Paso 1. */
  const filasLclEsperadas = useMemo(() => {
    if (sinFleteVenta || tipoEmbarque !== "LCL" || tarifaId) return [];
    const consolidador = proveedores.find((p) => p.id === lclFleteManual?.consolidadorId);
    return buildCostosLCLManual({
      lclFleteManual,
      dimensiones: dimensionesLCL,
      pesoKg,
      consolidadorNombre: consolidador?.nombre ?? null,
      markup, // B-075: mismo markup configurable que la rama FCL.
    });
  }, [sinFleteVenta, tipoEmbarque, tarifaId, proveedores, lclFleteManual, dimensionesLCL, pesoKg, markup]);

  // Precarga desde tarifa: sólo si la lista está vacía (no pisa nada capturado).
  useEffect(() => {
    if (!precargar || !tarifaId) { precargadaRef.current = null; return; }
    if (precargadaRef.current === firmaActual) return;
    precargadaRef.current = firmaActual;
    if (filas.length === 0) void cargar({ soloSiVacio: true });
  }, [precargar, tarifaId, firmaActual, filas.length, cargar]);

  // Precarga del flete LCL manual (una sola vez, guard con ref).
  useEffect(() => {
    if (!precargar) { precargadaLclRef.current = false; return; }
    if (sinFleteVenta || tipoEmbarque !== "LCL" || tarifaId) return;
    if (precargadaLclRef.current) return;
    if (filas.length > 0) { precargadaLclRef.current = true; return; }
    if (filasLclEsperadas.length === 0) return;
    setFilas((prev) => (prev.length > 0 ? prev : filasLclEsperadas));
    precargadaLclRef.current = true;
  }, [precargar, sinFleteVenta, tipoEmbarque, tarifaId, filas.length, filasLclEsperadas, setFilas]);

  const desajuste: DesajusteCostos | null = useMemo(() => {
    // P1-3/P2-5: cada fila automática debe pertenecer a la tarifa vigente.
    if (costosAutoDeOtraTarifa(filas, tarifaId).length > 0) return "tarifa_distinta";
    if (tarifaId && desajusteCantidadTarifa(filas, cantidad)) return "tarifa_cantidad";
    if (fleteLclDesactualizado(filas, filasLclEsperadas)) return "flete_lcl";
    return null;
  }, [tarifaId, filas, cantidad, filasLclEsperadas]);

  useEffect(() => {
    onDesajusteChange?.(precargar ? desajuste : null);
    return () => onDesajusteChange?.(null);
  }, [desajuste, onDesajusteChange, precargar]);

  const recalcular = useCallback(() => {
    if (desajuste === "flete_lcl") {
      setFilas((prev) => reemplazarCostosAutoFleteLcl(prev, filasLclEsperadas));
      return;
    }
    if (desajuste === "tarifa_distinta" && !tarifaId) {
      setFilas((prev) => sinCostosAutoTarifa(prev));
      return;
    }
    if (desajuste !== "tarifa_cantidad" && desajuste !== "tarifa_distinta") return;
    void cargar();
  }, [desajuste, tarifaId, filasLclEsperadas, cargar, setFilas]);

  const conservarManuales = useCallback(
    () => setFilas((prev) => conservarComoManuales(prev, tarifaId)),
    [setFilas, tarifaId],
  );

  return {
    tarifa, mostrarAvisoLclFcl, lclAutoCargado: filas.some(esCostoAutoFleteLcl), desajuste,
    recalculando: fase === "cargando",
    errorCargaTarifa: fase === "error",
    reintentarCargaTarifa: () => { void cargar(); },
    cargarTarifaElegida: (seleccionada) => { void cargar({ seleccionada }); },
    recalcular, conservarManuales,
  };
}
