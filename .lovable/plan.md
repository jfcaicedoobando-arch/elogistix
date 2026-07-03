## Problema

En el wizard "Conectar FacturApi" (paso 2 → 3), el rol **contador** ya puede guardar la API key (fix v13.170.15), pero el botón **Siguiente** sigue deshabilitado. No se puede avanzar al paso 3 (probar conexión).

## Causa raíz

El wizard habilita "Siguiente" cuando `keyActivaCargada` es `true`, y eso depende del `last4` que llega desde `useFacturapiCredenciales(orgId)` — un `SELECT` a `public.facturapi_credenciales`.

Las policies RLS actuales de esa tabla son solo dos, ambas restringidas a admin de la org:

```
admin_org puede gestionar credenciales facturapi de su org  (ALL)
admin_org puede leer credenciales facturapi de su org       (SELECT)
  USING: is_org_admin(uid, org) OR has_role(uid, 'super_admin')
```

Entonces el contador:

1. Llama al RPC `set_facturapi_api_key` → ✅ funciona (SECURITY DEFINER, ya lo permitimos).
2. La query `SELECT ... FROM facturapi_credenciales` que el wizard hace para leer `api_key_sandbox_last4` devuelve **0 filas** (RLS lo bloquea).
3. `data` queda `undefined` → `keyActivaCargada = false` → botón deshabilitado.

**Analogía:** la contadora tiene permiso de meter la llave a la caja fuerte, pero no de asomarse a ver si quedó bien puesta.

## Cambio propuesto

Ampliar las dos policies para que también acepten al rol `contador` (global, vía `has_role`). Igual criterio que el helper `_assert_facturapi_admin` corregido en v13.170.15 — mantenemos coherencia.

### Migración SQL

```sql
DROP POLICY IF EXISTS "admin_org puede leer credenciales facturapi de su org"
  ON public.facturapi_credenciales;
DROP POLICY IF EXISTS "admin_org puede gestionar credenciales facturapi de su org"
  ON public.facturapi_credenciales;

CREATE POLICY "leer credenciales facturapi de su org"
  ON public.facturapi_credenciales
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
  );

CREATE POLICY "gestionar credenciales facturapi de su org"
  ON public.facturapi_credenciales
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
  );
```

Los `GRANT` sobre la tabla ya existen para `authenticated` (SELECT/INSERT/UPDATE/DELETE). No cambian.

## Frontend

Ninguno. En cuanto RLS deje leer la fila, el hook `useFacturapiCredenciales` verá `api_key_sandbox_last4`, `keyActivaCargada` pasa a `true` y "Siguiente" se habilita automáticamente. El propio `useSetFacturapiApiKey` ya invalida el query key `["facturapi_credenciales", orgId]` en `onSuccess`, así que después de guardar la key el wizard refresca solo.

## Bump de versión y bitácora

- `src/constants/appVersion.ts` → `13.170.16`.
- `CHANGELOG.md`: entrada `[13.170.16] - 2026-07-04` explicando que el contador ya puede leer `facturapi_credenciales` y por tanto avanzar en el wizard.

## Fuera de alcance

- No se cambian otras policies ni se agregan roles adicionales.
- No se toca la UI del wizard ni el flujo del paso 3 (probar conexión).
- No se cambian los RPC `set_/clear_/get_facturapi_api_key` (ya arreglados en v13.170.15).
