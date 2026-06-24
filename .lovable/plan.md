## Causa raíz

Hay un trigger en `auth.users` (`public.handle_new_user_signup`) que en **cada** `INSERT` hace 3 cosas:

1. Crea una organización nueva llamada "Mi organización" (o el `company_name` del meta).
2. Mete al nuevo usuario como `admin` en ESA org recién creada.
3. Le asigna un rol global (`admin` o `super_admin` si es el primero).

Ese trigger fue diseñado para **self-signup** (un usuario se registra desde fuera y se autocrea su propia empresa). Pero ahora el super admin lo está usando para **crear miembros dentro de una org existente** (Chino Cochino). Resultado:

- Por cada miembro nuevo, se crea una org fantasma "Mi organización" y la membresía queda allí.
- Nuestro `handleCreate` luego intenta insertar la membresía en la org destino correcta… pero ahora con la restricción `UNIQUE(user_id)` en `organization_members` la inserción **fallará** y disparará el rollback que elimina el `auth.user`.
- En el último intento el rollback ni siquiera corrió porque el super admin no tenía `orgId` (sin membresía) y el frontend probablemente no envió `organization_id` (versión vieja de la edge function aún booteando). Por eso el usuario quedó huérfano en "Mi organización" (`92dd11d2`) en vez de en Chino Cochino.

**Analogía:** el trigger es como una recepcionista que, cada vez que entra alguien por la puerta principal, le construye automáticamente una oficina nueva en el piso 1. Pero ahora estamos contratando gente para piso 5 — necesitamos decirle "este nuevo entra a piso 5, no le construyas oficina".

## Cambios

### 1. Trigger `handle_new_user_signup` — respetar opt-out
Migración que reemplaza la función para que **saltee** los pasos 1–2 cuando `raw_user_meta_data->>'skip_auto_org'` es `'true'`. El paso 3 (rol global) sigue corriendo igual.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company_name text; v_org_id uuid;
  v_user_count int; v_global_role public.app_role;
  v_skip boolean := coalesce(NEW.raw_user_meta_data->>'skip_auto_org', 'false') = 'true';
BEGIN
  IF NOT v_skip THEN
    -- mismo bloque actual: crea org + membresía
    ...
  END IF;

  -- rol global (sin cambios)
  SELECT count(*) INTO v_user_count FROM public.user_roles;
  v_global_role := CASE WHEN v_user_count = 0 THEN 'super_admin' ELSE 'admin' END;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, v_global_role)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

### 2. Edge function `user-management` (handler `create`)
Pasar `user_metadata: { skip_auto_org: true }` en `adminClient.auth.admin.createUser({...})`. Así el trigger no le inventa una org fantasma y nuestra inserción manual en `organization_members` con la org destino correcta queda como única membresía.

### 3. Limpieza de datos del intento fallido
- Reasignar el usuario `7a357312-510e-433b-b74c-bedfc78b1845` (`admin@chino.com`) de la org "Mi organización" (`92dd11d2`) a Chino Cochino (`beff6600`) con rol `admin_org`.
- Eliminar la org fantasma `92dd11d2` "Mi organización" (no tiene más miembros ni datos).

### 4. Changelog + version bump
`13.135.3` con descripción del fix y la analogía.

## Fuera de alcance
- Cambiar el contrato de self-signup público (sigue funcionando igual: no manda el flag → auto-crea su empresa).
- Cambiar el rol global asignado por el trigger (sigue siendo `admin`; el handler de creación luego lo sobreescribe al rol elegido).
