import { useEffect, useRef } from "react";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

/** Una revisión/respuesta pertenece a una apertura, factura y envío concretos. */
export function useRecordatorioDialogScope(facturaId: string | undefined, open: boolean) {
  const current = useRef({ facturaId, open, generation: 0, submission: 0, mounted: true });
  if (current.current.facturaId !== facturaId || current.current.open !== open) {
    current.current = { ...current.current, facturaId, open, generation: current.current.generation + 1 };
  }
  useEffect(() => {
    current.current.mounted = true;
    return () => { current.current.mounted = false; current.current.generation++; };
  }, []);
  const capture = () => {
    const auth = captureAuthOperationScope();
    const { generation, submission } = current.current;
    return { isCurrent: () => auth.isCurrent() && current.current.mounted && current.current.open
      && current.current.generation === generation && current.current.submission === submission };
  };
  return { capture, beginSubmission: () => { current.current.submission++; return capture(); } };
}
