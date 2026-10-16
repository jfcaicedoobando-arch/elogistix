import { corsHeaders } from "../_shared/cors.ts";
import { demoIsAvailable, type DemoAvailabilityProvider } from "./availability.ts";

interface DemoUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
}

/** Only the existing operations used by this handler; no transport or secrets. */
export interface DemoAdminClient {
  auth: {
    admin: {
      listUsers(options: { page: number; perPage: number }): Promise<{
        data: { users: DemoUser[] }; error: unknown;
      }>;
      updateUserById(id: string, attributes: {
        password?: string; email_confirm: boolean; user_metadata: { full_name: string };
      }): Promise<{ error: unknown }>;
      createUser(attributes: {
        email: string; password: string; email_confirm: boolean; user_metadata: { full_name: string };
      }): Promise<{ data: { user: DemoUser | null }; error: unknown }>;
    };
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown; error: { message: string } | null;
  }>;
}

export interface DemoProbeClient {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: unknown }>;
    signOut(): Promise<unknown>;
  };
}

/** Composition-time server input only; never populate from a request. */
export interface DemoCredentials {
  readonly email: string;
  readonly password: string;
}

export interface DemoAccessDependencies {
  createAdminClient: () => DemoAdminClient;
  createProbeClient: () => DemoProbeClient;
  captureException: (error: unknown, context: { fn: string; status_code: number }) => Promise<void>;
  // Composition-time dependency only; no runtime flag or request-derived value.
  availabilityProvider?: DemoAvailabilityProvider;
  // Deliberately absent from the production adapter in this disabled release.
  credentials?: DemoCredentials;
}

export function createDemoAccessHandler(dependencies: DemoAccessDependencies): (req: Request) => Promise<Response> {
  const captureEdgeException = dependencies.captureException;
  const SEED_SKIP_MS = 10 * 60_000;

  function jsonRes(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
      status,
    });
  }

  function ipDeRequest(req: Request): string {
    // REF-05 · limitación conocida: la plataforma edge no garantiza que
    // x-forwarded-for / cf-connecting-ip vengan fijados por el proxy; un cliente
    // puede rotarlos y evadir el límite por IP. Mitigación: tope global por hora
    // en limitarPeticiones (independiente de la IP).
    return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
  }

  /**
   * EF-09: rate limit persistente fail-CLOSED (patrón client-error-log N51).
   * El endpoint es público por diseño; sin esto cada request re-sembraba
   * destructivamente la org demo (costo/DoS y carreras de seed).
   * Devuelve una Response cuando hay que cortar, o null si se puede continuar.
   */
  async function limitarPeticiones(admin: DemoAdminClient, req: Request): Promise<Response | null> {
    const { data: rl, error: rlErr } = await admin.rpc("check_ratelimit", {
      p_key: `demo-access:${ipDeRequest(req)}`,
      p_window_seconds: 60,
      p_max: 5,
    });
    if (rlErr) {
      console.error("demo-access ratelimit rpc failed:", rlErr.message);
      await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
        fn: "demo-access",
        status_code: 503,
      });
      return jsonRes({ error: "rate_limit_unavailable" }, 503, { "Retry-After": "30" });
    }
    const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
    if (rlResult?.ok === false) {
      return jsonRes({ error: "rate_limited" }, 429, { "Retry-After": String(rlResult.retry_after ?? 60) });
    }

    // REF-05: tope global por hora, independiente de la IP (el límite por IP es
    // evadible rotando XFF — ver nota en ipDeRequest). 30 seeds/hora es holgado
    // para uso legítimo del botón "Ver demo" y acota el abuso.
    const { data: gl, error: glErr } = await admin.rpc("check_ratelimit", {
      p_key: "demo-access:global",
      p_window_seconds: 3600,
      p_max: 30,
    });
    if (glErr) {
      console.error("demo-access global ratelimit rpc failed:", glErr.message);
      await captureEdgeException(new Error(`check_ratelimit failed: ${glErr.message}`), {
        fn: "demo-access",
        status_code: 503,
      });
      return jsonRes({ error: "rate_limit_unavailable" }, 503, { "Retry-After": "30" });
    }
    const glResult = gl as { ok?: boolean; retry_after?: number } | null;
    if (glResult?.ok === false) {
      return jsonRes({ error: "rate_limited" }, 429, { "Retry-After": String(glResult.retry_after ?? 300) });
    }
    return null;
  }

  /** Busca el usuario demo por email y lo crea (o resetea su password) según el caso. */
  async function asegurarUsuarioDemo(admin: DemoAdminClient, credentials: DemoCredentials): Promise<string> {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email?.toLowerCase() === credentials.email);

    if (existing) {
      // EC-2: sólo tocar la cuenta si hace falta. Antes cada llamada reseteaba el
      // password (invalidando sesiones demo activas) aunque ya fuera el correcto.
      //
      // BUG (Sentry JAVASCRIPT-REACT-1G, 13.733.0): este `signInWithPassword`
      // NO puede correr sobre el cliente `admin`. supabase-js guarda la sesión
      // del usuario demo EN MEMORIA (aunque `persistSession: false`) y a partir
      // de ahí manda su access token como `Authorization`, así que las RPC
      // siguientes dejaban de correr como `service_role` y fallaban con
      // `permission denied for function seed_demo_organization_guarded` (42501).
      // Se usa un cliente efímero y desechable sólo para la verificación.
      const probe = dependencies.createProbeClient();
      const { error: signInErr } = await probe.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      await probe.auth.signOut().catch(() => undefined);
      const passwordVigente = !signInErr;
      if (passwordVigente && existing.email_confirmed_at) return existing.id;


      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        ...(passwordVigente ? {} : { password: credentials.password }),
        email_confirm: true,
        user_metadata: { full_name: "Usuario Demo" },
      });
      if (updErr) throw updErr;
      return existing.id;
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: credentials.email,
      password: credentials.password,
      email_confirm: true,
      user_metadata: { full_name: "Usuario Demo" },
    });
    if (createErr) throw createErr;
    return created.user!.id;
  }

  /**
   * Re-siembra los datos de ejemplo — EF-09: omitir si se sembró hace <10 min
   * (cada llamada re-sembraba destructivamente).
   */
  async function resembrarSiHaceFalta(admin: DemoAdminClient): Promise<void> {
    // REF-05: la verificación de edad + seed + upsert del marcador ocurren en UNA
    // transacción serializada (pg_advisory_xact_lock) dentro de la RPC — el
    // chequeo previo en cliente era check-then-act y dos requests concurrentes
    // dentro de la ventana re-sembraban en paralelo.
    const { data: sembrada, error: seedErr } = await admin.rpc("seed_demo_organization_guarded", {
      p_skip_ms: SEED_SKIP_MS,
    });
    if (seedErr) throw seedErr;
    if (sembrada === false) {
      console.log("demo-access: seed omitido (sembrado hace <10 min)");
    }
  }

  function mensajeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return JSON.stringify(err);
  }

  return async (req) => {

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // This runs before constructing a client, Auth reads/writes or any SQL RPC.
    // Production deliberately has no trusted provider wired in this proposal.
    if (!await demoIsAvailable(dependencies.availabilityProvider)) {
      return jsonRes({ error: "demo_unavailable" }, 503, {
        "Retry-After": "30",
        "Cache-Control": "no-store",
      });
    }

    // A future availability decision alone cannot enable credential operations.
    // This release supplies no credentials; request fields are never consulted.
    const credentials = dependencies.credentials;
    if (!credentials || typeof credentials.email !== "string" || !credentials.email.trim() ||
        typeof credentials.password !== "string" || !credentials.password.trim()) {
      return jsonRes({ error: "demo_unavailable" }, 503, {
        "Retry-After": "30",
        "Cache-Control": "no-store",
      });
    }

    try {
      const admin = dependencies.createAdminClient();

      const corte = await limitarPeticiones(admin, req);
      if (corte) return corte;

      const userId = await asegurarUsuarioDemo(admin, credentials);

      // Asegurar membership (operador en org demo).
      const { error: memErr } = await admin.rpc("ensure_demo_membership", { _user_id: userId });
      if (memErr) throw memErr;

      await resembrarSiHaceFalta(admin);

      return jsonRes({ email: credentials.email, password: credentials.password }, 200);
    } catch (err) {
      console.error("demo-access error:", mensajeError(err), err);
      await captureEdgeException(err, { fn: "demo-access", status_code: 500 });
      // REF-05: endpoint público — no filtrar err.message (huella interna).
      // El detalle queda en logs de plataforma y en Sentry.
      return jsonRes({ error: "demo_access_failed" }, 500);
    }
  };
}
