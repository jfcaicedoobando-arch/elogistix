## Causa raíz

En `/agente/tarifas` el modal usa `fetchCosteoRutas(organizationId)` que hace `SELECT * FROM costeo_rutas`. La tabla tiene RLS:

```
costeo_rutas_select_org → EXISTS (organization_members WHERE user_id = auth.uid())
```

El usuario del Portal Agente vive en `agente_users`, **no** en `organization_members`, así que el `SELECT` regresa 0 filas. Es el mismo problema que ya resolvimos para el contexto del agente (org y nombre) en la v13.135.29 con la RPC `get_current_agente_context()`.

Nota: este bug existía antes del cambio multi-ruta; con el Select sencillo también salía vacío. El combobox sólo lo hace más visible.

## Solución

Crear una RPC `SECURITY DEFINER` que devuelva las rutas activas de la organización del agente autenticado, saltándose RLS de forma segura (la función internamente valida que el caller sea un `agente_user` y resuelve su `organization_id` vía `current_agente_org()`).

### Backend (migration)

```sql
CREATE OR REPLACE FUNCTION public.get_agente_rutas()
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  puerto_origen_id uuid,
  puerto_destino_id uuid,
  activa boolean,
  puerto_origen_nombre text,
  puerto_destino_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.organization_id, r.puerto_origen_id, r.puerto_destino_id, r.activa,
         po.name AS puerto_origen_nombre,
         pd.name AS puerto_destino_nombre
    FROM public.costeo_rutas r
    JOIN public.agente_users au ON au.user_id = auth.uid()
    JOIN public.costeo_agentes a ON a.id = au.agente_id
                                 AND a.organization_id = r.organization_id
    LEFT JOIN public.puertos po ON po.id = r.puerto_origen_id
    LEFT JOIN public.puertos pd ON pd.id = r.puerto_destino_id
   WHERE r.activa = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_agente_rutas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agente_rutas() TO authenticated;
```

Sólo devuelve rutas de la organización a la que pertenece el agente — no hay fuga cross-org. Si el caller no es agente, regresa vacío.

### Client

- `src/features/portal-agente/services/index.ts` (o un archivo de servicios de rutas del portal): nueva función `fetchAgenteRutas()` que llama `supabase.rpc("get_agente_rutas")` y devuelve el array.
- `src/features/portal-agente/components/AgenteTarifaForm.tsx`: cambiar el `useQuery` para usar `fetchAgenteRutas()` en lugar de `fetchCosteoRutas(ctx.organizationId)`. Mismo shape (id, activa, puerto_origen_nombre, puerto_destino_nombre), así que `TarifaForm` no cambia.

### Versionado

- `src/constants/appVersion.ts` → `13.135.32`
- `CHANGELOG.md` → entrada `[13.135.32]`: "Portal Agente: el modal de Nueva tarifa ya lista las rutas de la organización vinculada. Nueva RPC `get_agente_rutas()` (`SECURITY DEFINER`) porque `agente_users` no tiene SELECT directo sobre `costeo_rutas` por RLS."

## Fuera de alcance

- Tocar las políticas RLS de `costeo_rutas` (mantener la regla de membresía organizacional).
- Cambios en el Portal interno (`/costeo`) — ahí sí funciona porque el usuario es miembro.
