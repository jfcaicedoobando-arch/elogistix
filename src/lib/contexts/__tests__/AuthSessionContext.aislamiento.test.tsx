/**
 * Regresión del paso 11: el `Session` volátil vive en un contexto estrecho.
 *
 * Cuando rota el `access_token` (TOKEN_REFRESHED), el consumidor del
 * AuthContext general NO debe re-renderizar (su `value` no cambia); sólo el
 * consumidor de `useAuthSessionToken` recibe el token nuevo.
 *
 * Harness determinista: el mock de `useAuthSession` lee una variable mutable
 * y forzamos la rotación con `rerender` (sin timers). Los consumidores van
 * envueltos en `React.memo` para que sólo un cambio de contexto los re-renderice.
 */
import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { memo } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "../AuthContext";
import { useAuthSessionToken } from "../auth/AuthSessionContext";
import { createWrapper } from "@/test/utils/queryWrapper";

const USUARIO = { id: "u-1" } as User;

// Sesión controlable: el hook interno se llama UNA sola vez por AuthProvider.
let sesionActual: Session | null = null;
const useAuthSessionMock = vi.fn(() => ({
  user: USUARIO,
  session: sesionActual,
  loading: false,
  lastEvent: null,
}));

vi.mock("../auth/useAuthSession", () => ({
  useAuthSession: () => useAuthSessionMock(),
}));
const PERFIL_ESTABLE = { role: null, orgRole: null, organizationId: null, organization: null };
// Funciones ESTABLES entre renders: si el mock creara un vi.fn() nuevo por
// llamada, el `value` memoizado del AuthContext cambiaría de identidad y la
// prueba mediría al mock, no al aislamiento del token.
const resetEstable = vi.fn();
const refreshEstable = vi.fn();
const clearLoginAuditEstable = vi.fn();
vi.mock("../auth/useAuthProfile", () => ({
  useAuthProfile: () => ({ profile: PERFIL_ESTABLE, profileLoading: false, profileError: false, reset: resetEstable, refresh: refreshEstable }),
}));
vi.mock("../auth/useLoginAudit", () => ({
  useLoginAudit: () => ({ clearLoginAudit: clearLoginAuditEstable }),
}));
vi.mock("@/lib/auth/signOut", () => ({ signOutCurrentSession: vi.fn() }));
vi.mock("@/lib/supabase/cast", () => ({ fromDb: (x: unknown) => x }));
vi.mock("@/lib/auth/authSnapshot", () => ({ setAuthSnapshot: vi.fn() }));
vi.mock("@/lib/observability/sentry/user", () => ({ syncSentryUser: vi.fn() }));
vi.mock("@/lib/auth/authSnapshotBuilder", () => ({
  buildAuthSnapshot: vi.fn(() => ({})),
  buildSentryUserContext: vi.fn(() => ({})),
}));

describe("AuthSessionContext (aislamiento del token)", () => {
  it("la rotación del access_token no re-renderiza a consumidores de useAuth y sí al de useAuthSessionToken", () => {
    // Contadores/valores como PROPIEDADES de un objeto (no reasignación de
    // variables externas) para cumplir la regla de pureza de react-compiler.
    const sonda = {
      rendersGeneral: 0,
      rendersToken: 0,
      userVisto: null as User | null,
      tokenVisto: null as string | null,
    };

    const ConsumidorGeneral = memo(() => {
      // eslint-disable-next-line react-compiler/react-compiler -- sonda de test: contar renders ES la aserción
      sonda.rendersGeneral += 1;
      sonda.userVisto = useAuth().user;
      return null;
    });
    const ConsumidorToken = memo(() => {
      // eslint-disable-next-line react-compiler/react-compiler -- sonda de test: contar renders ES la aserción
      sonda.rendersToken += 1;
      sonda.tokenVisto = useAuthSessionToken()?.access_token ?? null;
      return null;
    });

    const QueryWrapper = createWrapper();
    // Función que crea elementos NUEVOS en cada render: reutilizar el mismo
    // elemento haría que React abortara el re-render por identidad.
    const arbol = () => (
      <QueryWrapper>
        <AuthProvider>
          <ConsumidorGeneral />
          <ConsumidorToken />
        </AuthProvider>
      </QueryWrapper>
    );

    sesionActual = { access_token: "token-v1" } as Session;
    const { rerender } = render(arbol());
    expect(sonda.rendersGeneral).toBe(1);
    expect(sonda.rendersToken).toBe(1);
    expect(sonda.tokenVisto).toBe("token-v1");

    // Rotación: mismo usuario, nuevo access_token (como TOKEN_REFRESHED).
    sesionActual = { access_token: "token-v2" } as Session;
    rerender(arbol());

    // El valor del contexto general no cambió: su consumidor no re-renderizó.
    expect(sonda.rendersGeneral).toBe(1);
    expect(sonda.userVisto).toBe(USUARIO);
    // El contexto estrecho sí publicó el token nuevo.
    expect(sonda.rendersToken).toBe(2);
    expect(sonda.tokenVisto).toBe("token-v2");
    // La suscripción interna se invoca una vez por render del provider (sin
    // listeners duplicados: el mock reemplaza al hook que suscribe).
    expect(useAuthSessionMock).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("useAuthSessionToken fuera del provider devuelve null (no lanza)", () => {
    const sonda = { token: "inicial" as string | null };
    const Sonda = () => {
      // eslint-disable-next-line react-compiler/react-compiler -- sonda de test: capturar el valor ES la aserción
      sonda.token = useAuthSessionToken()?.access_token ?? null;
      return null;
    };
    render(<Sonda />);
    expect(sonda.token).toBeNull();
    cleanup();
  });
});
