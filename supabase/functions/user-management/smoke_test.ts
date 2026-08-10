/**
 * Smoke test post-deploy para `user-management` en PRODUCCIÓN.
 *
 * Verifica que el edge function desplegado responde con el contrato esperado
 * (status estructurado, JSON, sin UIDs huérfanos sin email). Falla si:
 *  - El endpoint devuelve 5xx o HTML (función caída / mal desplegada).
 *  - La respuesta no respeta el shape esperado.
 *  - Aparece un user_id UUID sin email adyacente (regresión exacta del bug
 *    "salen UIDs en vez de emails" que originó este test).
 *
 * Se ejecuta en CI nightly contra producción (https://elogistix.lovable.app).
 * Localmente queda `ignore: true` si faltan DEMO_USER_EMAIL / DEMO_USER_PASSWORD.
 */
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
await load({ export: true, envPath: ".env", examplePath: null });
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Ola 8 · B1: sin credenciales incrustadas; el smoke test exige el entorno.
function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta la variable de entorno ${name} para correr el smoke test`);
  return v;
}

const SUPABASE_URL = requireEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

const DEMO_EMAIL = Deno.env.get("DEMO_USER_EMAIL");
const DEMO_PASSWORD = Deno.env.get("DEMO_USER_PASSWORD");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signInDemo(): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Login demo falló: ${res.status} ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(text) as { access_token?: string };
  if (!parsed.access_token) throw new Error("Login demo sin access_token");
  return parsed.access_token;
}

Deno.test({
  name: "smoke: user-management list responde JSON estructurado en producción",
  ignore: !DEMO_EMAIL || !DEMO_PASSWORD,
  async fn() {
    const jwt = await signInDemo();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/user-management`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ action: "list", scope: "global" }),
    });

    const rawBody = await res.text();
    const contentType = res.headers.get("content-type") ?? "";

    // 1. Nunca 5xx ni HTML
    assert(
      res.status < 500,
      `Status 5xx (función caída): ${res.status} → ${rawBody.slice(0, 200)}`,
    );
    assert(
      contentType.toLowerCase().startsWith("application/json"),
      `Content-Type no es JSON (probable HTML de error): ${contentType}`,
    );

    // 2. Body parsea como JSON (puede ser array directo o { users: [...] } / { error })
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error(`Body no es JSON válido: ${rawBody.slice(0, 200)}`);
    }

    // 3. Demo es rol 'cliente': esperamos 200 con array de users o 401/403 con { error }
    if (res.status === 200) {
      const users = Array.isArray(body)
        ? body
        : (body as { users?: unknown }).users;
      assert(
        Array.isArray(users),
        `200 sin array de users en el body: ${rawBody.slice(0, 200)}`,
      );
      for (const u of users as Array<Record<string, unknown>>) {
        const userId = u.user_id ?? u.id;
        if (typeof userId === "string" && UUID_RE.test(userId)) {
          assert(
            "email" in u && typeof u.email === "string" && u.email.length > 0,
            `Regresión detectada: user_id=${userId} sin email adyacente. ` +
              `Esto es exactamente el bug que el frontend mostraba como "salen UIDs en vez de emails".`,
          );
        }
      }
    } else {
      assertEquals(
        [401, 403].includes(res.status),
        true,
        `Status inesperado para demo readonly: ${res.status} → ${rawBody.slice(0, 200)}`,
      );
      assert(
        typeof (body as { error?: unknown }).error === "string",
        "Respuesta de error sin campo `error` string",
      );
    }
  },
});
