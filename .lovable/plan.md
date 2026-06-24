## Causa raíz

Analogía: el agente tiene su llave de la puerta de "agente_users" (RLS lo deja leer su propia fila), pero la cerradura del `costeo_agentes` y de `organizations` está cerrada para él (sus políticas exigen ser miembro de `organization_members`, que un agente externo NO es). Resultado: el `select` con joins regresa silenciosamente `costeo_agentes: null` y por eso el header cae al fallback "Portal Agente · **Agente**". Y aunque la RPC `get_current_agente_org_nombre()` sí existe y tiene EXECUTE, la lógica del header oculta el chip cuando viene vacío.

Lo que confirma el preview (`Chino el agente` logueado): se ve `Portal Agente · Agente` en vez de `Portal Agente · Chino El Agente`, y no aparece el chip de "Chino Cochino".

## Solución

Una sola RPC `SECURITY DEFINER` que devuelva todo el contexto del agente saltándose RLS, y cambiar `fetchAgenteContext` para usarla.

### Cambios

1. **Migración SQL** — crear RPC consolidada:
   ```sql
   CREATE OR REPLACE FUNCTION public.get_current_agente_context()
   RETURNS TABLE (
     agente_id uuid, organization_id uuid, proveedor_id uuid,
     agente_nombre text, organizacion_nombre text
   )
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
   AS $$
     SELECT au.agente_id, au.organization_id, ca.proveedor_id,
            ca.nombre, o.nombre
       FROM public.agente_users au
       LEFT JOIN public.costeo_agentes ca ON ca.id = au.agente_id
       LEFT JOIN public.organizations  o  ON o.id  = au.organization_id
      WHERE au.user_id = auth.uid()
      LIMIT 1;
   $$;
   REVOKE EXECUTE ON FUNCTION public.get_current_agente_context() FROM PUBLIC, anon;
   GRANT  EXECUTE ON FUNCTION public.get_current_agente_context() TO authenticated;
   ```
   (mantenemos `get_current_agente_org_nombre()` para no romper nada).

2. **Cliente** `src/features/portal-agente/services/index.ts` — reemplazar el `.from("agente_users").select(...costeo_agentes(...))` + RPC de org por una sola `supabase.rpc("get_current_agente_context")`. Si devuelve 0 filas → `notAuthenticated`. Mapeo directo al `AgenteContext`. Sin cambios en la interface ni en los consumidores.

3. **Versión + changelog**
   - `src/constants/appVersion.ts` → `13.135.29`
   - `CHANGELOG.md` → entrada `[13.135.29]` describiendo el fix.

## Validación

- Abrir `/agente` en preview como Chino. El header debe decir `Portal Agente · Chino El Agente` y el chip `🏢 Chino Cochino`.
- Verificar con Playwright + screenshot.

## Fuera de alcance

- No abrimos RLS de `costeo_agentes` ni `organizations` (mantener principio de menor privilegio).
- No tocamos UI, sólo la fuente de datos.
