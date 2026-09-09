/**
 * v13.506.0 — Pre-marca en el formulario de captura los conceptos de costo que
 * el operador ya señaló al subir el documento al buzón.
 * v13.507.0 — Devuelve qué se aplicó y qué se descartó (ya facturado) para
 * poder explicarlo en pantalla y permitir "volver a aplicar".
 *
 * Sólo se aplica una vez por documento y se descartan los conceptos que ya
 * quedaron cubiertos por otra factura viva (evita doble vinculación).
 *
 * Conciliación multi-moneda (fix ELIMP00329): el importe pre-marcado va SIEMPRE
 * en la moneda de la factura. Antes se copiaba el monto del costo tal cual (51
 * USD tratado como 51 MXN contra una factura de 872.57 MXN), y el ajuste de
 * costo salía por casi la factura completa (821.57 MXN fantasma). Ahora se
 * convierte con el T/C DOF de la fecha de emisión, igual que la marca manual, y
 * si no hay T/C no se pre-marca: se avisa en pantalla.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCostosConFactura } from "@/features/embarques/services/costosConFactura";
import { convertirMonto, type TcPivote } from "@/features/cxp/utils/vinculoMoneda";
import type { ConceptoSugeridoEntrante } from "@/features/cxp/services/facturasEntrantesConceptos";
import type { EntranteParaCaptura } from "@/features/cxp/types";

interface Sugerencia {
  conceptoId: string;
  concepto: string;
  monto: number;
  embarque_id: string;
}

interface Args {
  entrante: EntranteParaCaptura | null | undefined;
  abierto: boolean;
  /** Espera a que el proveedor esté elegido: elegirlo limpia los vínculos. */
  habilitado: boolean;
  aplicarSugerencias: (sugs: ReadonlyArray<Sugerencia>) => void;
  /** Moneda de la factura que se captura: define la moneda del importe marcado. */
  facturaMoneda: string;
  /** T/C DOF de la fecha de emisión (pivote MXN); `null` mientras carga. */
  tc: TcPivote | null;
}

export interface HerenciaSugerencias {
  /** Conceptos sugeridos que sí se pre-marcaron. */
  aplicados: ConceptoSugeridoEntrante[];
  /** Sugerencias descartadas porque ya tienen otra factura viva. */
  descartados: ConceptoSugeridoEntrante[];
  /** Sugerencias en otra moneda que no se pudieron convertir por falta de T/C. */
  sinTipoCambio: ConceptoSugeridoEntrante[];
  /** Vuelve a marcar los conceptos aplicables (por si el contador los quitó). */
  reaplicar: () => void;
}

/** `true` si alguna sugerencia está en una moneda distinta a la de la factura. */
export function requiereConversion(
  lista: readonly ConceptoSugeridoEntrante[],
  facturaMoneda: string,
): boolean {
  return lista.some((s) => s.moneda !== facturaMoneda);
}

/**
 * Separa las sugerencias convertibles a la moneda de la factura de las que no
 * lo son por falta de T/C. Función pura.
 */
export function dividirPorTipoCambio(
  lista: readonly ConceptoSugeridoEntrante[],
  facturaMoneda: string,
  tc: TcPivote | null,
): { convertibles: ConceptoSugeridoEntrante[]; sinTipoCambio: ConceptoSugeridoEntrante[] } {
  const convertibles: ConceptoSugeridoEntrante[] = [];
  const sinTipoCambio: ConceptoSugeridoEntrante[] = [];
  for (const s of lista) {
    const monto = convertirMonto(s.monto, s.moneda, facturaMoneda, tc);
    if (monto === null) sinTipoCambio.push(s);
    else convertibles.push(s);
  }
  return { convertibles, sinTipoCambio };
}

export function usePrefillVinculosEntrante({
  entrante, abierto, habilitado, aplicarSugerencias, facturaMoneda, tc,
}: Args): HerenciaSugerencias {
  const aplicadoPara = useRef<string | null>(null);
  const [aplicados, setAplicados] = useState<ConceptoSugeridoEntrante[]>([]);
  const [descartados, setDescartados] = useState<ConceptoSugeridoEntrante[]>([]);
  const [sinTipoCambio, setSinTipoCambio] = useState<ConceptoSugeridoEntrante[]>([]);

  // Se usa `tc` directo: si su identidad cambia, el efecto sólo se reevalúa y
  // `aplicadoPara` evita volver a pre-marcar el mismo documento.
  const aRegistro = useCallback(
    (lista: readonly ConceptoSugeridoEntrante[], embarqueId: string): Sugerencia[] =>
      lista.flatMap((s) => {
        const monto = convertirMonto(s.monto, s.moneda, facturaMoneda, tc);
        if (monto === null) return [];
        return [{
          conceptoId: s.conceptoCostoId,
          concepto: s.concepto,
          monto,
          embarque_id: embarqueId,
        }];
      }),
    [facturaMoneda, tc],
  );

  useEffect(() => {
    if (!abierto || !entrante || !habilitado) return;
    const sugeridos = entrante.conceptosSugeridos ?? [];
    if (sugeridos.length === 0 || aplicadoPara.current === entrante.id) return;
    // Sin T/C no se pre-marca nada convertible: se espera a que llegue el DOF.
    if (requiereConversion(sugeridos, facturaMoneda) && !tc) return;

    let vivo = true;
    aplicadoPara.current = entrante.id;
    void (async () => {
      let cubiertos = new Set<string>();
      try {
        cubiertos = await fetchCostosConFactura(entrante.embarqueId);
      } catch {
        // Si no se puede consultar, se pre-marca todo: el cuadre avisará.
      }
      if (!vivo) return;
      const libres = sugeridos.filter((s) => !cubiertos.has(s.conceptoCostoId));
      const { convertibles, sinTipoCambio: sinTc } =
        dividirPorTipoCambio(libres, facturaMoneda, tc);
      setAplicados(convertibles);
      setSinTipoCambio(sinTc);
      setDescartados(sugeridos.filter((s) => cubiertos.has(s.conceptoCostoId)));
      if (convertibles.length > 0) {
        aplicarSugerencias(aRegistro(convertibles, entrante.embarqueId));
      }
    })();

    return () => { vivo = false; };
  }, [abierto, entrante, habilitado, aplicarSugerencias, aRegistro, facturaMoneda, tc]);

  useEffect(() => {
    if (!abierto) {
      aplicadoPara.current = null;
      setAplicados([]);
      setDescartados([]);
      setSinTipoCambio([]);
    }
  }, [abierto]);

  const reaplicar = useCallback(() => {
    if (!entrante || aplicados.length === 0) return;
    aplicarSugerencias(aRegistro(aplicados, entrante.embarqueId));
  }, [entrante, aplicados, aplicarSugerencias, aRegistro]);

  return { aplicados, descartados, sinTipoCambio, reaplicar };
}
