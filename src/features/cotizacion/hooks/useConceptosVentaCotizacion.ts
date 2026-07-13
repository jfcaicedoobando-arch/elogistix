import { useState, useMemo, useCallback } from "react";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";

import { calcularIVA, calcularTotalConIVA, resolverTasaConcepto, sumarSubtotales, sumarMontos } from "@/lib/financial/financialUtils";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";

// ── Factories ──
const emptyUSD = (): ConceptoVentaCotizacion => ({
  descripcion: "", unidad_medida: "", cantidad: 1, precio_unitario: 0, moneda: "USD", total: 0, aplica_iva: false, tasa_iva_aplicada: 0, notas: "",
});
const emptyMXN = (tasaDefault: number): ConceptoVentaCotizacion => ({
  descripcion: "", unidad_medida: "", cantidad: 1, precio_unitario: 0, moneda: "MXN", total: 0, aplica_iva: true, tasa_iva_aplicada: tasaDefault, notas: "",
});

interface Options {
  initialUSD?: ConceptoVentaCotizacion[];
  initialMXN?: ConceptoVentaCotizacion[];
}

export function useConceptosVentaCotizacion(options: Options = {}) {
  const tasaIva = useTasaIVA();

  const [conceptosUSD, setConceptosUSD] = useState<ConceptoVentaCotizacion[]>(
    options.initialUSD && options.initialUSD.length > 0 ? options.initialUSD : [emptyUSD()]
  );
  const [conceptosMXN, setConceptosMXN] = useState<ConceptoVentaCotizacion[]>(
    options.initialMXN && options.initialMXN.length > 0 ? options.initialMXN : [emptyMXN(tasaIva)]
  );

  const actualizarConcepto = useCallback((moneda: "USD" | "MXN", index: number, campo: string, valor: string | number | boolean) => {
    if (campo === "_esOtro") return;
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      // El tipo de IVA lo determina el producto seleccionado del catálogo,
      // que setea `aplica_iva` y `tasa_iva_aplicada` explícitamente después
      // de la descripción. No hay reset por descripción libre.
      // Mantener consistencia entre tasa y flag booleano.
      if (campo === "tasa_iva_aplicada" && typeof valor === "number") {
        copia[index].aplica_iva = valor > 0;
      }
      if (campo === "aplica_iva" && typeof valor === "boolean") {
        copia[index].tasa_iva_aplicada = valor ? tasaIva : 0;
      }
      const sub = copia[index].cantidad * copia[index].precio_unitario;
      const tasaFila = resolverTasaConcepto(copia[index], tasaIva);
      copia[index].total = calcularTotalConIVA(sub, tasaFila);
      return copia;
    });
  }, [tasaIva]);

  const agregarConcepto = useCallback((moneda: "USD" | "MXN") => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => [...prev, moneda === "USD" ? emptyUSD() : emptyMXN(tasaIva)]);
  }, [tasaIva]);

  /**
   * P2 cierre (v13.296.0) — inserta un concepto con datos precargados desde
   * `AgregarConceptoInline`. Calcula total con IVA en el momento.
   */
  const agregarConceptoPrefill = useCallback(
    (moneda: "USD" | "MXN", prefill: Partial<ConceptoVentaCotizacion>) => {
      const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
      const base = moneda === "USD" ? emptyUSD() : emptyMXN(tasaIva);
      const merged: ConceptoVentaCotizacion = { ...base, ...prefill, moneda };
      const sub = merged.cantidad * merged.precio_unitario;
      const tasaFila = resolverTasaConcepto(merged, tasaIva);
      merged.total = calcularTotalConIVA(sub, tasaFila);
      setter(prev => [...prev, merged]);
    },
    [tasaIva],
  );

  const eliminarConcepto = useCallback((moneda: "USD" | "MXN", index: number) => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const totalUSD = useMemo(() => sumarMontos(conceptosUSD.map((c) => c.total)), [conceptosUSD]);
  const subtotalMXN = useMemo(
    () => sumarSubtotales(conceptosMXN, (c) => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario })),
    [conceptosMXN],
  );
  const ivaMXN = useMemo(
    () => sumarMontos(conceptosMXN.map((c) => calcularIVA(c.cantidad * c.precio_unitario, resolverTasaConcepto(c, tasaIva)))),
    [conceptosMXN, tasaIva],
  );
  const totalMXN = useMemo(() => subtotalMXN + ivaMXN, [subtotalMXN, ivaMXN]);

  return {
    conceptosUSD, conceptosMXN,
    setConceptosUSD, setConceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,
    tasaIva,
  };
}
