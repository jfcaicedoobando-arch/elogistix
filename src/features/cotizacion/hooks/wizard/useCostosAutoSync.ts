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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { buildCostosDesdeTarifa } from "@/features/cotizacion/components/seccionRuta/buildCostosDesdeTarifa";
import { buildCostosLCLManual } from "@/features/cotizacion/components/seccionRuta/buildCostosLCLManual";
import { useProveedoresLite } from "@/features/proveedor/hooks/useProveedores";
import {
  desajusteCantidadTarifa,
  fleteLclDesactualizado,
  reemplazarCostosAutoFleteLcl,
  reemplazarCostosAutoTarifa,
  type DesajusteCostos,
} from "@/features/cotizacion/domain/costosAutoGenerados";
import type { CotizacionFormValues, FilaCostoLocal } from "@/features/cotizacion/types";

interface Args {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
  /** Reporta el desajuste vigente al wizard (bloquea "Siguiente"). */
  onDesajusteChange?: (d: DesajusteCostos | null) => void;
}

export interface CostosAutoSync {
  tarifa: ReturnType<typeof useTarifaVinculada>["data"];
  mostrarAvisoLclFcl: boolean;
  lclAutoCargado: boolean;
  desajuste: DesajusteCostos | null;
  recalculando: boolean;
  recalcular: () => void;
}

export function useCostosAutoSync({ filas, setFilas, onDesajusteChange }: Args): CostosAutoSync {
  const { watch } = useFormContext<CotizacionFormValues>();
  const tarifaId = watch("tarifaId");
  const numContenedores = watch("numContenedores") ?? 1;
  const tipoEmbarque = watch("tipoEmbarque");
  const lclFleteManual = watch("lclFleteManual");
  const dimensionesLCL = watch("dimensionesLCL");
  const pesoKg = watch("pesoKg");

  const { data: tarifa } = useTarifaVinculada(tarifaId);
  const { data: proveedores = [] } = useProveedoresLite();
  const markup = useConfigValue<number>("cotizaciones", "markup_default_maritimo", 0.15);

  const cantidad = Math.max(1, Number(numContenedores) || 1);
  const precargadaRef = useRef<string | null>(null);
  const precargadaLclRef = useRef<boolean>(false);
  const [lclAutoCargado, setLclAutoCargado] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  // Desajuste tarifa (FCL) ↔ cotización (LCL): `costeo_tarifas` está modelada
  // para contenedor; una tarifa con `tipo_contenedor_nombre` en una cotización
  // LCL genera unidades inconsistentes si no se convierte a m³.
  const mostrarAvisoLclFcl = !!tarifa?.tipo_contenedor_nombre && tipoEmbarque === "LCL";

  /** Filas que hoy produciría el bloque "Flete LCL manual" del Paso 1. */
  const filasLclEsperadas = useMemo(() => {
    if (tipoEmbarque !== "LCL" || tarifaId) return [];
    const consolidador = proveedores.find((p) => p.id === lclFleteManual?.consolidadorId);
    return buildCostosLCLManual({
      lclFleteManual,
      dimensiones: dimensionesLCL,
      pesoKg,
      consolidadorNombre: consolidador?.nombre ?? null,
      markup, // B-075: mismo markup configurable que la rama FCL.
    });
  }, [tipoEmbarque, tarifaId, proveedores, lclFleteManual, dimensionesLCL, pesoKg, markup]);

  /** Filas de flete + recargos que hoy produciría la tarifa vinculada. */
  const construirFilasTarifa = useCallback(async (): Promise<FilaCostoLocal[]> => {
    if (!tarifaId) return [];
    const row = await fetchTarifaVinculada(tarifaId);
    if (!row) return [];
    const recargos = await fetchRecargosDeTarifa(row.id);
    return buildCostosDesdeTarifa({ tarifa: row, recargos, markup, cantidad, tipoEmbarque });
  }, [tarifaId, markup, cantidad, tipoEmbarque]);

  // Precarga desde tarifa: sólo si la lista está vacía (no pisa nada capturado).
  useEffect(() => {
    if (!tarifaId) return;
    if (precargadaRef.current === tarifaId) return;
    if (filas.length > 0) { precargadaRef.current = tarifaId; return; }
    let cancelado = false;
    void construirFilasTarifa().then((nuevas) => {
      if (cancelado || nuevas.length === 0) return;
      setFilas((prev) => (prev.length > 0 ? prev : nuevas));
      precargadaRef.current = tarifaId;
    });
    return () => { cancelado = true; };
  }, [tarifaId, filas.length, setFilas, construirFilasTarifa]);

  // Precarga del flete LCL manual (una sola vez, guard con ref).
  useEffect(() => {
    if (tipoEmbarque !== "LCL" || tarifaId) return;
    if (precargadaLclRef.current) return;
    if (filas.length > 0) { precargadaLclRef.current = true; return; }
    if (filasLclEsperadas.length === 0) return;
    setFilas((prev) => (prev.length > 0 ? prev : filasLclEsperadas));
    precargadaLclRef.current = true;
    setLclAutoCargado(true);
  }, [tipoEmbarque, tarifaId, filas.length, filasLclEsperadas, setFilas]);

  const desajuste: DesajusteCostos | null = useMemo(() => {
    if (tarifaId && desajusteCantidadTarifa(filas, cantidad)) return "tarifa_cantidad";
    if (fleteLclDesactualizado(filas, filasLclEsperadas)) return "flete_lcl";
    return null;
  }, [tarifaId, filas, cantidad, filasLclEsperadas]);

  useEffect(() => {
    onDesajusteChange?.(desajuste);
    return () => onDesajusteChange?.(null);
  }, [desajuste, onDesajusteChange]);

  const recalcular = useCallback(() => {
    if (desajuste === "flete_lcl") {
      setFilas((prev) => reemplazarCostosAutoFleteLcl(prev, filasLclEsperadas));
      return;
    }
    if (desajuste !== "tarifa_cantidad") return;
    setRecalculando(true);
    void construirFilasTarifa()
      .then((nuevas) => {
        if (nuevas.length > 0) setFilas((prev) => reemplazarCostosAutoTarifa(prev, nuevas));
      })
      .finally(() => setRecalculando(false));
  }, [desajuste, filasLclEsperadas, construirFilasTarifa, setFilas]);

  return { tarifa, mostrarAvisoLclFcl, lclAutoCargado, desajuste, recalculando, recalcular };
}
