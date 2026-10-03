/**
 * Avisa sólo ante un fallo real al consultar el directorio; no atribuye la
 * ausencia de un nombre ni los correos privados a un fallo de autenticación.
 * (Auditoría Paso 6: separar side-effects derivados de datos).
 */
import { useEffect, useRef } from "react";
import { notifyWarning } from "@/lib/ui/appFeedback";

interface VendedoraLike { estadoIdentidad: string }

export function useVendedorasEmailWarning(vendedoras: VendedoraLike[]) {
  const warnedRef = useRef(false);
  useEffect(() => {
    if (warnedRef.current || vendedoras.length === 0) return;
    const unresolved = vendedoras.filter((v) => v.estadoIdentidad === "error_consulta").length;
    if (unresolved > 0) {
      warnedRef.current = true;
      notifyWarning(undefined, {
        title: "No se pudo consultar el directorio de vendedoras",
        description: `No se pudo identificar a ${unresolved} vendedora(s). Reintenta la consulta antes de generar una liquidación.`,
        method: "COMISIONES_VENDEDORAS_DIRECTORIO_ERROR",
      });
    }
  }, [vendedoras]);
}
