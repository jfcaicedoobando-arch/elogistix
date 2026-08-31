/**
 * Destino de la tarjeta "Por pagar" del dashboard financiero (`/inicio`).
 *
 * La bandeja `/compras/por-pagar` es del tesorero/administración
 * (`COMPRAS_POR_PAGAR_ROLES`): el contador NO la tiene ni en su menú ni en el
 * guard de ruta. La tarjeta enlazaba siempre a esa bandeja, así que el contador
 * caía en `/sin-acceso`. Sin ampliar permisos, la tarjeta lleva al listado de
 * facturas de proveedor (`/compras/facturas`, `FINANCE_READ_ROLES`), que tiene
 * el mismo significado en modo consulta; si tampoco lo tiene, al hub de Compras.
 */
import { ROUTES } from "@/constants/routes";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import type { AppRole } from "@/types/appRole";

export function resolveDestinoPorPagar(role: AppRole | null | undefined): string | undefined {
  const candidatas = [ROUTES.COMPRAS_POR_PAGAR, ROUTES.COMPRAS_FACTURAS, ROUTES.COMPRAS];
  return candidatas.find((ruta) => hasRouteAccess(role, ruta));
}
