import { useCallback, useRef, useState } from "react";
import {
  descargarProformaCreada, submitProformaDialog,
  type ProformaCreadaParaPdf, type SubmitProformaParams,
} from "../services/submitProformaDialog";

/** Distingue creación transaccional de descarga recuperable y evita doble clic. */
export function useProformaGeneracion() {
  const enCurso = useRef(false);
  const creadaRef = useRef<ProformaCreadaParaPdf | null>(null);
  const [creada, setCreada] = useState<ProformaCreadaParaPdf | null>(null);
  const [isPending, setPending] = useState(false);

  const reiniciar = useCallback(() => {
    creadaRef.current = null;
    setCreada(null);
  }, []);

  const ejecutar = async (params: SubmitProformaParams): Promise<boolean> => {
    if (enCurso.current) return false;
    enCurso.current = true;
    setPending(true);
    try {
      if (creadaRef.current) {
        await descargarProformaCreada(creadaRef.current, params.fetchClienteParaPdfCached);
      } else {
        await submitProformaDialog({ ...params, onCreada: (snapshot) => {
          creadaRef.current = snapshot;
          setCreada(snapshot);
        } });
      }
      return true;
    } finally {
      enCurso.current = false;
      setPending(false);
    }
  };

  return { creada, isPending, ejecutar, reiniciar };
}
