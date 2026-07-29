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
  limpiar: () => void;
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

  const limpiar = useCallback(() => setConceptos([]), []);

  return { conceptos, agregar, actualizar, eliminar, limpiar };
}
