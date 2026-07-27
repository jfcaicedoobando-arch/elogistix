/**
 * Side-effect hook: muestra un toast warning una sola vez si hay vendedoras
 * sin email resuelto. Extraído de la página `Comisiones`
 * (Auditoría Paso 6: separar side-effects derivados de datos).
 */
import { useEffect, useRef } from "react";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";

interface VendedoraLike { email: string }

export function useVendedorasEmailWarning(vendedoras: VendedoraLike[]) {
  const warnedRef = useRef(false);
  useEffect(() => {
    if (warnedRef.current || vendedoras.length === 0) return;
    const unresolved = vendedoras.filter((v) => v.email === UNRESOLVED_EMAIL).length;
    if (unresolved > 0) {
      warnedRef.current = true;
      notifyWarning(undefined, {
        title: "Correos de vendedoras no disponibles",
        description: `No se pudieron resolver los correos de ${unresolved} vendedora(s). Verifica la conexión con el servidor de autenticación.`,
        method: "COMISIONES_VENDEDORAS_EMAIL_UNRESOLVED",
      });
    }
  }, [vendedoras]);
}
