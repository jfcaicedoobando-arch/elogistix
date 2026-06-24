# Fix: error 500 en `demo-access` (Sentry JAVASCRIPT-REACT-1G)

## Qué pasó (en simple)
El botón **"Probar demo"** llama a la edge function `demo-access`, que entre otras cosas se asegura de que el usuario demo pertenezca a la organización demo. Esa función llamó a la RPC `ensure_demo_membership`, y la base reventó con:

> duplicate key value violates unique constraint **`organization_members_user_id_unique`**

**Analogía:** la tabla `organization_members` tiene una regla "un usuario sólo puede pertenecer a UNA organización" (constraint `UNIQUE(user_id)`). La RPC intentó insertar al usuario demo, y como `ON CONFLICT` estaba mirando otra cerradura (`UNIQUE(organization_id, user_id)`), no detectó el choque y la inserción explotó.

Probablemente el usuario `933a08f5-…` quedó vinculado a otra organización en algún flujo previo, así que al entrar a demo ya no se puede re-insertar.

## La causa raíz
RPC actual:
```sql
INSERT INTO public.organization_members (user_id, organization_id, role)
VALUES (_user_id, 'de100000-…', 'admin')
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';
```
La tabla tiene DOS constraints únicas:
- `UNIQUE(organization_id, user_id)` ← el que mira el ON CONFLICT
- `UNIQUE(user_id)` ← el que realmente falla

## Plan

### 1. Migración nueva: corregir `ensure_demo_membership`
Cambiar el `ON CONFLICT` para que apunte a `(user_id)` y reasigne al usuario demo a la organización demo (forzando overwrite). Así, sin importar a qué org haya quedado vinculado, vuelve a la demo.

```sql
CREATE OR REPLACE FUNCTION public.ensure_demo_membership(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (_user_id, 'de100000-0000-0000-0000-000000000001'::uuid, 'admin'::app_role)
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        role            = EXCLUDED.role;
END;
$function$;
```
(También se ajusta el `ON CONFLICT` de `user_roles` para usar su llave real `(user_id, role)`.)

### 2. Versionado y changelog
- Bump `APP_VERSION` → `13.135.13`
- Entrada en `CHANGELOG.md` describiendo el fix
- Marcar el issue `JAVASCRIPT-REACT-1G` como resuelto en Sentry una vez aplicado

## Archivos a tocar
- `supabase/migrations/<timestamp>_fix_ensure_demo_membership.sql` (nuevo)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Lo que NO cambia
- No se tocan tablas, RLS ni la edge function `demo-access`.
- No se quita el constraint `UNIQUE(user_id)` (es intencional: 1 usuario = 1 org).
