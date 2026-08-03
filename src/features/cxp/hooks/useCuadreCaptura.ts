/**
 * v13.400.1 — Derivados de cuadre para la captura de factura de proveedor.
 * Extraído de `DialogNuevaFacturaProveedor.tsx` para respetar Power of 10 #4
 * (archivos productivos <= 200 líneas). Sin cambios de lógica.
 */
import { useMemo } from "react";
import {
  calcularCuadreConceptos,
  type ConceptoParaCuadre,
} from "@/features/cxp/utils/cuadreConceptos";
import { resolverConceptosParaCuadre } from "@/features/cxp/utils/conceptosParaCuadre";

interface ConceptoManual {
  key: string;
  importe?: number | string | null;
  cantidad?: number | null;
}

interface Params {
  subtotal: number;
  cfdiConceptos: Parameters<typeof resolverConceptosParaCuadre>[0];
  conceptosManuales: ConceptoManual[];
  vinculos: Parameters<typeof resolverConceptosParaCuadre>[2];
}

export function useCuadreCaptura({ subtotal, cfdiConceptos, conceptosManuales, vinculos }: Params) {
  const conceptosParaCuadre = useMemo<ConceptoParaCuadre[]>(
    () => resolverConceptosParaCuadre(cfdiConceptos, conceptosManuales, vinculos),
    [cfdiConceptos, conceptosManuales, vinculos],
  );

  const cuadre = useMemo(
    () => calcularCuadreConceptos(subtotal, conceptosParaCuadre),
    [subtotal, conceptosParaCuadre],
  );

  // Con sobrante, señalamos el renglón manual de línea más alta: es el candidato
  // típico a "importe unitario capturado como total de línea".
  const keyRenglonSospechoso = useMemo(() => {
    if (cuadre.estado !== "sobrante") return null;
    const linea = (c: ConceptoManual) => (Number(c.importe) || 0) * (Number(c.cantidad) || 1);
    return (
      conceptosManuales.reduce<{ key: string; total: number } | null>((peor, c) => {
        const total = linea(c);
        return !peor || total > peor.total ? { key: c.key, total } : peor;
      }, null)?.key ?? null
    );
  }, [cuadre.estado, conceptosManuales]);

  return { conceptosParaCuadre, cuadre, keyRenglonSospechoso };
}
