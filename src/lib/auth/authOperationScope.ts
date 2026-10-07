import { getAuthSnapshot } from "./authSnapshot";
import { captureErrorReportScope } from "@/lib/diagnostics/errorReportScope";
import { clearErrorReports } from "@/lib/diagnostics/errorDetailsStore";

type ActiveContext = { userId: string | null; organizationId: string | null };
let active: ActiveContext = { userId: null, organizationId: null };

/** Incluye el tenant efectivo del superadmin, separado de su perfil de plataforma. */
export function syncActiveOrganizationScope(next: ActiveContext): void {
  if (next.userId !== active.userId || next.organizationId !== active.organizationId) {
    clearErrorReports();
  }
  active = next;
}

function currentContext() {
  const auth = getAuthSnapshot();
  return { userId: auth.userId, role: auth.effectiveRole,
    organizationId: active.userId === auth.userId ? active.organizationId : auth.organizationId };
}

export class AuthOperationChangedError extends Error {
  readonly expected = true;
  constructor() {
    super("La operación se canceló porque cambió el usuario o la organización activa.");
    this.name = "AuthOperationChangedError";
  }
}

/** Sólo identidad y ámbito en memoria; nunca tokens ni datos de documentos. */
export function captureAuthOperationScope() {
  const started = currentContext();
  const sameGeneration = captureErrorReportScope();
  const isCurrent = () => {
    const current = currentContext();
    return sameGeneration() && started.userId === current.userId
      && started.organizationId === current.organizationId && started.role === current.role;
  };
  return { organizationId: started.organizationId, isCurrent,
    assertCurrent: () => { if (!isCurrent()) throw new AuthOperationChangedError(); } };
}
