## Problema

Isela (rol **contador**) ahora completa el wizard, guarda su API key sandbox, **prueba conexión ok** en el paso 3, pero al intentar **timbrar** una factura la edge function responde:

```
412 – Falta la API key (sandbox) de FacturApi para esta organización.
```

## Causa raíz

El helper `_shared/facturapiAuth.ts::resolveFacturapiKey` resuelve la key en 3 pasos:

1. `SELECT ... FROM facturapi_credenciales` (necesita RLS). ✅
2. `rpc("get_facturapi_api_key_internal", …)` → **desencripta el secret desde `vault.decrypted_secrets`**. Esta RPC está:

   ```
   REVOKE ALL ... FROM public, anon, authenticated;
   GRANT EXECUTE ... TO service_role;
   ```

3. Fallback a `Deno.env.get(<secret_name>)` — legado; hoy nadie usa esa ruta.

Cada edge function crea el cliente de Supabase así:

```ts
createClient(SUPABASE_URL, SERVICE_KEY, {
  global: { headers: { Authorization: authHeader } }, // JWT del usuario
});
```

Cuando `Authorization: Bearer <JWT>` viaja en cada request, **PostgREST usa ese JWT** y las llamadas se ejecutan bajo el rol `authenticated`, no `service_role`. Por eso el `rpc("get_facturapi_api_key_internal")` devuelve permission denied → `tryVaultKey` devuelve `null` → cae al fallback de `secret_name` que también es `null` (nadie configuró secrets de proyecto) → `412 Falta la API key`.

**Analogía:** la contadora ya tiene su llave en la caja fuerte, pero cuando el mostrador va a abrirla lo hace con el gafete de "cliente" en vez del gafete de "gerente". La caja no reconoce el gafete y le dice "no tengo llave para ti".

## Cambio propuesto

Un solo archivo: `supabase/functions/_shared/facturapiAuth.ts`.

Cuando estén disponibles `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el runtime (siempre lo están en producción), `tryVaultKey` construirá **su propio cliente admin** con service role sin `Authorization` header y llamará el RPC con ese cliente. El `SELECT` inicial sigue con el cliente pasado por el caller (el RLS ya está bien).

Bosquejo (dentro del mismo helper):

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let adminSingleton: SupabaseLike | null = null;
function getAdmin(): SupabaseLike | null {
  if (adminSingleton) return adminSingleton;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null; // tests: no admin, se ignora
  adminSingleton = createClient(url, key, { auth: { persistSession: false } }) as unknown as SupabaseLike;
  return adminSingleton;
}

async function tryVaultKey(userClient, orgId, ambiente, vaultId) {
  if (!vaultId) return null;
  const admin = getAdmin() ?? userClient; // fallback para tests
  if (!admin.rpc) return null;
  const { data, error } = await admin.rpc("get_facturapi_api_key_internal", {
    p_org_id: orgId, p_ambiente: ambiente,
  });
  if (error) return null;
  return typeof data === "string" && data.length > 0 ? data : null;
}
```

Ventajas:
- **Un solo archivo tocado.** Las 9 edge functions que ya llaman `getFacturapiClient(userClient, orgId)` no cambian.
- **Tests no rompen:** cuando no hay env vars (entorno Deno.test aislado), cae al mock inyectado por el caller.
- **No amplía privilegios en la BD.** Sigue siendo únicamente el helper server-side el que llega al vault.

## Verificación

Tras deploy:
1. Isela vuelve a Configuración → wizard → "Probar" (ya funciona) para confirmar que sí lee la key.
2. Isela abre una factura y presiona **Timbrar**. Debe emitirse sin `412`.
3. Edge function logs de `facturapi-emitir` deben mostrar 200.

## Bump de versión y bitácora

- `src/constants/appVersion.ts` → `13.170.17`.
- `CHANGELOG.md`: entrada `[13.170.17] - 2026-07-04` explicando por qué la RPC del vault se llama con service role.

## Fuera de alcance

- No se tocan las 9 edge functions que consumen `getFacturapiClient` (misma firma).
- No se cambian policies ni GRANTS.
- No se toca el flujo de UI ni el hook `useTimbrarFactura`.
- Refactor de tests de `facturapiAuth_test.ts` sólo si el flujo `tryVaultKey` requiere ajustes (no debería, porque el mock se sigue usando cuando no hay env vars).
