import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { getAuthSnapshot } from "@/lib/auth/authSnapshot";
import { subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { newRequestId } from "@/lib/idempotency";
import { PagoProveedorResultadoIncierto, type RegistrarPagoProveedorInput } from "@/features/cxp/services";
import { useRegistrarPagoProveedor } from "./usePagosProveedor";

type DatosPago = Omit<RegistrarPagoProveedorInput, "client_request_id">;

interface IntentoPago {
  userId: string;
  estado: "en_curso" | "incierto";
  input: DatosPago & { client_request_id: string };
}

const intentos = new Map<string, IntentoPago>();
const listeners = new Set<() => void>();

function publicar(clave: string, intento: IntentoPago | null) {
  if (intento) intentos.set(clave, intento);
  else intentos.delete(clave);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

subscribeSessionCacheGeneration(() => {
  const userId = getAuthSnapshot().userId;
  for (const [clave, intento] of intentos) {
    if (intento.userId !== userId) publicar(clave, null);
  }
});

export function useIntentoPagoProveedor(facturaId: string | null) {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const registrar = useRegistrarPagoProveedor();
  const clave = user && organizationId && facturaId
    ? JSON.stringify([user.id, organizationId, facturaId])
    : null;
  const intento = useSyncExternalStore(subscribe, () => clave ? intentos.get(clave) ?? null : null);

  async function confirmar(input?: DatosPago) {
    if (!clave || !user) return;
    const anterior = intentos.get(clave);
    if (anterior?.estado === "en_curso") return;
    const datos = anterior?.input ?? (input ? { ...input, client_request_id: newRequestId() } : null);
    if (!datos) return;
    const enCurso: IntentoPago = { userId: user.id, estado: "en_curso", input: datos };
    publicar(clave, enCurso);
    try {
      const resultado = await registrar.mutateAsync(datos);
      if (intentos.get(clave) === enCurso) publicar(clave, null);
      return resultado;
    } catch (error) {
      if (intentos.get(clave) === enCurso) {
        publicar(clave, anterior || error instanceof PagoProveedorResultadoIncierto
          ? { ...enCurso, estado: "incierto" }
          : null);
      }
      throw error;
    }
  }

  return {
    intento, confirmar, disponible: clave !== null,
    guardando: registrar.isPending || intento?.estado === "en_curso",
  };
}
