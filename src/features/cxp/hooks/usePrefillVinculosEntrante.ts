/**
 * v13.506.0 — Pre-marca en el formulario de captura los conceptos de costo que
 * el operador ya señaló al subir el documento al buzón.
 *
 * Sólo se aplica una vez por documento y se descartan los conceptos que ya
 * quedaron cubiertos por otra factura viva (evita doble vinculación).
 */
import { useEffect, useRef } from "react";
import { fetchCostosConFactura } from "@/features/embarques/services/costosConFactura";
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
  aplicarSugerencias: (sugs: ReadonlyArray<Sugerencia>) => void;
}

export function usePrefillVinculosEntrante({ entrante, abierto, aplicarSugerencias }: Args) {
  const aplicadoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!abierto || !entrante) return;
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
      const aplicables = sugeridos
        .filter((s) => !cubiertos.has(s.conceptoCostoId))
        .map((s) => ({
          conceptoId: s.conceptoCostoId,
          concepto: s.concepto,
          monto: s.monto,
          embarque_id: entrante.embarqueId,
        }));
      if (aplicables.length > 0) aplicarSugerencias(aplicables);
    })();

    return () => { vivo = false; };
  }, [abierto, entrante, aplicarSugerencias]);

  useEffect(() => {
    if (!abierto) aplicadoPara.current = null;
  }, [abierto]);
}
