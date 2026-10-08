import { useEffect, useRef } from "react";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export interface TimbradoScope {
  organizationId: string;
  isAuthCurrent: () => boolean;
  authScope: ReturnType<typeof captureAuthOperationScope>;
}

/** Una confirmación pertenece a una apertura, documento, cliente y destinatario. */
export function useTimbradoScope(
  factura: { id: string; organization_id?: string; cliente_id: string | null } | null | undefined,
  email: string | null | undefined, open: boolean,
) {
  const identity = JSON.stringify([factura?.id, factura?.organization_id, factura?.cliente_id, email]);
  const current = useRef({ identity, open, generation: 0, mounted: true });
  if (current.current.identity !== identity || current.current.open !== open) {
    current.current = { identity, open, generation: current.current.generation + 1, mounted: true };
  }
  useEffect(() => {
    current.current.mounted = true;
    return () => { current.current.mounted = false; current.current.generation++; };
  }, []);
  return (organizationId?: string): TimbradoScope | undefined => {
    const auth = captureAuthOperationScope();
    if (!organizationId || auth.organizationId !== organizationId || !open || !current.current.mounted || current.current.identity !== identity) return;
    const generation = current.current.generation;
    const isCurrent = () => auth.isCurrent() && current.current.mounted
      && current.current.open && current.current.generation === generation;
    return { organizationId, isAuthCurrent: auth.isCurrent, authScope: { organizationId, isCurrent,
      assertCurrent: () => { if (!isCurrent()) throw new AuthOperationChangedError(); } } };
  };
}
