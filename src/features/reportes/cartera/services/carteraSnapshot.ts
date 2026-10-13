/** Une los saldos y la identidad al mismo ámbito autenticado del reporte. */
import { fetchCobranza, fetchCobranzaKpis } from "@/features/facturacion/services";
import { fetchFacturasCxP } from "@/features/cxp/services";
import { AuthOperationChangedError, captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { getSuperAdminOrg } from "@/services/organization";

export type CarteraDataScope = Pick<ReturnType<typeof captureAuthDataScope>,
  "userId" | "organizationId" | "role" | "generation">;

export function isCarteraScopeCurrent(scope: CarteraDataScope | undefined): boolean {
  if (!scope?.userId || (!scope.organizationId && scope.role !== "super_admin")) return false;
  const current = captureAuthDataScope();
  return current.isCurrent() && scope.userId === current.userId
    && scope.organizationId === current.organizationId && scope.role === current.role
    && scope.generation === current.generation;
}

export function assertCarteraScopeCurrent(scope: CarteraDataScope): void {
  if (!isCarteraScopeCurrent(scope)) throw new AuthOperationChangedError();
}

/** org_scope puede seguir en A mientras el selector local ya muestra B. */
async function assertServerScope(scope: CarteraDataScope, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  assertCarteraScopeCurrent(scope);
  const organizationId = await getSuperAdminOrg();
  signal?.throwIfAborted();
  assertCarteraScopeCurrent(scope);
  if (organizationId !== scope.organizationId) {
    throw new Error("La organización del reporte aún no está sincronizada. Intenta de nuevo.");
  }
}

export async function fetchCarteraSnapshot(scope: CarteraDataScope, diaNegocio: string, signal?: AbortSignal) {
  await assertServerScope(scope, signal);
  const abortArgs: [AbortSignal?] = signal ? [signal] : [];
  const [cxc, cxp] = await Promise.all([
    fetchCobranza({}, ...abortArgs),
    fetchFacturasCxP({}, diaNegocio, ...abortArgs),
    // Conserva el gate de error remoto de useCobranza; no altera los totales.
    fetchCobranzaKpis({}, ...abortArgs),
  ]);
  await assertServerScope(scope, signal);
  return { cxc, cxp, scope };
}
