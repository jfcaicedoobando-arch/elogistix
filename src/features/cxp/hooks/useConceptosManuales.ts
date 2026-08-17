/**
 * Estado de los conceptos capturados a mano en una factura de proveedor
 * (Q-02, v13.339.0).
 *
 * Antes solo se podían registrar conceptos vía XML CFDI o vinculando costos de
 * un embarque: toda factura capturada manualmente quedaba sin partidas y la RPC
 * `aprobar_factura_proveedor` la rechazaba con `LC_CXP_SIN_CONCEPTOS`.
 */
import { useCallback, useState } from "react";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

export interface ConceptoManual extends CfdiConceptoParsed {
  /** Key estable para React (evita re-montar inputs al editar — ver Q-07). */
  key: string;
}

let seq = 0;
function nextKey(): string {
  seq += 1;
  return `cm-${seq}`;
}

export function crearConceptoManual(): ConceptoManual {
  return { key: nextKey(), descripcion: "", cantidad: 1, importe: 0, iva: 0, ieps: 0 };
}

export interface ConceptosManualesApi {
  conceptos: ConceptoManual[];
  agregar: () => void;
  actualizar: <K extends keyof CfdiConceptoParsed>(
    key: string,
    campo: K,
    valor: CfdiConceptoParsed[K],
  ) => void;
  eliminar: (key: string) => void;
  /** Clona un renglón y lo inserta justo debajo (captura repetitiva). */
  duplicar: (key: string) => void;
  /**
   * Reparte `diferencia` (subtotal − suma) en el importe unitario del renglón
   * indicado para cerrar el descuadre sin recalcular a mano.
   */
  ajustarDiferencia: (key: string, diferencia: number) => void;
  limpiar: () => void;
  /** Sustituye toda la lista (precarga al editar conceptos existentes). */
  reemplazar: (conceptos: ReadonlyArray<CfdiConceptoParsed>) => void;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function useConceptosManuales(): ConceptosManualesApi {
  const [conceptos, setConceptos] = useState<ConceptoManual[]>([]);

  const agregar = useCallback(() => {
    setConceptos((prev) => [...prev, crearConceptoManual()]);
  }, []);

  const actualizar = useCallback(
    <K extends keyof CfdiConceptoParsed>(key: string, campo: K, valor: CfdiConceptoParsed[K]) => {
      setConceptos((prev) => prev.map((c) => (c.key === key ? { ...c, [campo]: valor } : c)));
    },
    [],
  );

  const eliminar = useCallback((key: string) => {
    setConceptos((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const duplicar = useCallback((key: string) => {
    setConceptos((prev) => {
      const i = prev.findIndex((c) => c.key === key);
      if (i < 0) return prev;
      const copia: ConceptoManual = { ...prev[i], key: nextKey() };
      return [...prev.slice(0, i + 1), copia, ...prev.slice(i + 1)];
    });
  }, []);

  const ajustarDiferencia = useCallback((key: string, diferencia: number) => {
    setConceptos((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const cantidad = c.cantidad && c.cantidad !== 0 ? c.cantidad : 1;
        return { ...c, importe: redondear2((Number(c.importe) || 0) + diferencia / cantidad) };
      }),
    );
  }, []);

  const limpiar = useCallback(() => setConceptos([]), []);

  const reemplazar = useCallback((lista: ReadonlyArray<CfdiConceptoParsed>) => {
    setConceptos(lista.map((c) => ({ ...c, key: nextKey() })));
  }, []);

  return { conceptos, agregar, actualizar, eliminar, duplicar, ajustarDiferencia, limpiar, reemplazar };
}

