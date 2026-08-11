/**
 * v13.506.0 — Pre-marca en el formulario de captura los conceptos de costo que
 * el operador ya señaló al subir el documento al buzón.
 * v13.507.0 — Devuelve qué se aplicó y qué se descartó (ya facturado) para
 * poder explicarlo en pantalla y permitir "volver a aplicar".
 *
 * Sólo se aplica una vez por documento y se descartan los conceptos que ya
 * quedaron cubiertos por otra factura viva (evita doble vinculación).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCostosConFactura } from "@/features/embarques/services/costosConFactura";
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
}

export interface HerenciaSugerencias {
  /** Conceptos sugeridos que sí se pre-marcaron. */
  aplicados: ConceptoSugeridoEntrante[];
  /** Sugerencias descartadas porque ya tienen otra factura viva. */
  descartados: ConceptoSugeridoEntrante[];
  /** Vuelve a marcar los conceptos aplicables (por si el contador los quitó). */
  reaplicar: () => void;
}

export function usePrefillVinculosEntrante({
  entrante, abierto, habilitado, aplicarSugerencias,
}: Args): HerenciaSugerencias {
  const aplicadoPara = useRef<string | null>(null);
  const [aplicados, setAplicados] = useState<ConceptoSugeridoEntrante[]>([]);
  const [descartados, setDescartados] = useState<ConceptoSugeridoEntrante[]>([]);

  const aRegistro = useCallback(
    (lista: readonly ConceptoSugeridoEntrante[], embarqueId: string): Sugerencia[] =>
      lista.map((s) => ({
        conceptoId: s.conceptoCostoId,
        concepto: s.concepto,
        monto: s.monto,
        embarque_id: embarqueId,
      })),
    [],
  );

  useEffect(() => {
    if (!abierto || !entrante || !habilitado) return;
    const sugeridos = entrante.conceptosSugeridos ?? [];
    if (sugeridos.length === 0 || aplicadoPara.current === entrante.id) return;

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
      const aplicables = sugeridos.filter((s) => !cubiertos.has(s.conceptoCostoId));
      setAplicados(aplicables);
      setDescartados(sugeridos.filter((s) => cubiertos.has(s.conceptoCostoId)));
      if (aplicables.length > 0) {
        aplicarSugerencias(aRegistro(aplicables, entrante.embarqueId));
      }
    })();

    return () => { vivo = false; };
  }, [abierto, entrante, habilitado, aplicarSugerencias, aRegistro]);

  useEffect(() => {
    if (!abierto) {
      aplicadoPara.current = null;
      setAplicados([]);
      setDescartados([]);
    }
  }, [abierto]);

  const reaplicar = useCallback(() => {
    if (!entrante || aplicados.length === 0) return;
    aplicarSugerencias(aRegistro(aplicados, entrante.embarqueId));
  }, [entrante, aplicados, aplicarSugerencias, aRegistro]);

  return { aplicados, descartados, reaplicar };
}
