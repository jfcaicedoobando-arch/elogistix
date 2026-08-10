/**
 * Segregación de funciones (SoD) en el cliente para aprobar facturas de proveedor.
 *
 * Espejo de la regla de BD (`aprobar_factura_proveedor`): quien capturó la
 * factura no puede aprobarla, salvo roles administradores. Se evalúa ANTES del
 * clic para deshabilitar el botón con una explicación, en lugar de mostrar el
 * error rojo `LC_SOD_VIOLATION` después de intentarlo.
 */
import { useCallback } from "react";
import { useAuth } from "@/hooks/shared/useAuth";
import type { AppRole } from "@/types/appRole";
import { motivoBloqueoAprobacion } from "@/features/cxp/permissions";

interface FacturaSod {
  id: string;
  created_by: string | null;
}

export function useSodAprobacion() {
  const { user, effectiveRole } = useAuth();
  const role = (effectiveRole ?? null) as AppRole | null;
  const userId = user?.id ?? null;

  /** Motivo del bloqueo, o `null` si el usuario sí puede aprobar esa factura. */
  const motivoBloqueo = useCallback(
    (createdBy: string | null | undefined): string | null =>
      motivoBloqueoAprobacion({ role, userId, createdBy }),
    [role, userId],
  );

  /** Ids de facturas que este usuario NO puede aprobar (para selección en lote). */
  const idsBloqueados = useCallback(
    (facturas: readonly FacturaSod[]): Set<string> =>
      new Set(facturas.filter((f) => motivoBloqueo(f.created_by) !== null).map((f) => f.id)),
    [motivoBloqueo],
  );

  return { motivoBloqueo, idsBloqueados };
}
