/** Invalida sólo continuaciones pendientes; no aborta una escritura ya enviada. */
import { useLayoutEffect, useMemo, useRef } from "react";

export function useFacturaAsyncScope(facturaId: string | undefined, open = true) {
  const scope = useMemo(() => ({ facturaId, open }), [facturaId, open]);
  const actual = useRef<{ activo: boolean; scope: typeof scope } | null>(null);
  useLayoutEffect(() => {
    // Cada montaje/ciclo tiene su token; StrictMode nunca revive uno anterior.
    const ciclo = { activo: scope.open, scope };
    actual.current = ciclo;
    return () => { ciclo.activo = false; };
  }, [scope]);
  const capturar = () => {
    const ciclo = actual.current;
    return () => ciclo?.activo === true && ciclo.scope === scope && actual.current === ciclo;
  };
  return { scope, capturar };
}
