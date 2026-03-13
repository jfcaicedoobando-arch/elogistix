import { useState, useMemo, useCallback } from "react";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { CONCEPTOS_CON_IVA_USD } from "@/data/cotizacionConstants";
import { calcularIVA, calcularTotalConIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";

// ── Factories ──
const emptyUSD = (): ConceptoVentaCotizacion => ({
  descripcion: "", unidad_medida: "", cantidad: 1, precio_unitario: 0, moneda: "USD", total: 0, aplica_iva: false,
});
const emptyMXN = (): ConceptoVentaCotizacion => ({
  descripcion: "", unidad_medida: "", cantidad: 1, precio_unitario: 0, moneda: "MXN", total: 0, aplica_iva: true,
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
    options.initialMXN && options.initialMXN.length > 0 ? options.initialMXN : [emptyMXN()]
  );

  const actualizarConcepto = useCallback((moneda: "USD" | "MXN", index: number, campo: string, valor: string | number | boolean) => {
    if (campo === "_esOtro") return;
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      if (moneda === "USD" && campo === "descripcion" && typeof valor === "string" && !(CONCEPTOS_CON_IVA_USD as readonly string[]).includes(valor)) {
        copia[index].aplica_iva = false;
      }
      const sub = copia[index].cantidad * copia[index].precio_unitario;
      copia[index].total = moneda === "MXN" ? calcularTotalConIVA(sub, tasaIva) : (copia[index].aplica_iva ? calcularTotalConIVA(sub, tasaIva) : sub);
      return copia;
    });
  }, [tasaIva]);

  const agregarConcepto = useCallback((moneda: "USD" | "MXN") => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    const factory = moneda === "USD" ? emptyUSD : emptyMXN;
    setter(prev => [...prev, factory()]);
  }, []);

  const eliminarConcepto = useCallback((moneda: "USD" | "MXN", index: number) => {
    const setter = moneda === "USD" ? setConceptosUSD : setConceptosMXN;
    setter(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const totalUSD = useMemo(() => conceptosUSD.reduce((s, c) => s + c.total, 0), [conceptosUSD]);
  const subtotalMXN = useMemo(() => conceptosMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0), [conceptosMXN]);
  const ivaMXN = useMemo(() => calcularIVA(subtotalMXN, tasaIva), [subtotalMXN, tasaIva]);
  const totalMXN = useMemo(() => calcularTotalConIVA(subtotalMXN, tasaIva), [subtotalMXN, tasaIva]);

  return {
    conceptosUSD, conceptosMXN,
    setConceptosUSD, setConceptosMXN,
    actualizarConcepto, agregarConcepto, eliminarConcepto,
    totalUSD, subtotalMXN, ivaMXN, totalMXN,
    tasaIva,
  };
}
