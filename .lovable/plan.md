## Objetivo

Al confirmar el registro, el nuevo usuario debe quedar listo para operar:
- Una **organización** recién creada (con el nombre de empresa que ingresó).
- Una fila en **`organization_members`** con rol **`admin`** vinculándolo a esa organización.
- Su rol global en **`user_roles`** queda en `admin` (ya cubierto por el trigger existente para usuarios no-primero, lo ajustamos).

Así, al entrar a `/inicio` por primera vez, el `AuthContext` resuelve organización efectiva y permite usar la app sin intervención manual.

## Cambios

### 1. UI de registro (`src/pages/auth/components/SignupForm.tsx`)
- Nuevo campo obligatorio **"Nombre de empresa"** (entre "Nombre completo" y "Email").
- Validación: `trim`, 2-120 caracteres.
- Se envía en el metadata del signup como `company_name`, junto con `full_name`.

### 2. Servicio (`src/services/auth/index.ts`)
- `SignUpInput` agrega `companyName: string`.
- `signUpWithEmail` lo pasa a `options.data.company_name`.

### 3. Migración SQL (nueva)
Reemplazar la función `public.handle_first_user_role` por **`public.handle_new_user_signup`** (SECURITY DEFINER, `search_path=public`) que en un solo `AFTER INSERT ON auth.users`:

1. Lee `NEW.raw_user_meta_data->>'company_name'` (fallback: `'Mi organización'`).
2. Inserta en `public.organizations` (nombre = company_name, plan='basic'), devolviendo `new_org_id`.
3. Inserta en `public.organization_members` (organization_id=new_org_id, user_id=NEW.id, role='admin').
4. Inserta en `public.user_roles`:
   - Si es el primer usuario global → `super_admin`.
   - En cualquier otro caso → `admin` (admin de su propia org, no global).
5. Todo con `ON CONFLICT DO NOTHING` para idempotencia (el trigger es AFTER INSERT pero si Supabase reintenta, evitamos doble inserción).

Reemplaza el trigger `on_auth_user_created` para apuntar a la nueva función. Se mantiene `handle_first_user_role` por compatibilidad (no se borra; solo deja de usarse) — opcional, podemos `DROP FUNCTION` también.

### 4. Bump de versión + CHANGELOG
`APP_VERSION = 13.45.0` (feature, no patch) y entrada nueva en `CHANGELOG.md` raíz.

## Detalles técnicos

- **No tocamos** `src/integrations/supabase/client.ts`, `types.ts`, `supabase/config.toml`.
- **Roles del catálogo** (`app_role`): se asume que `'admin'` y `'super_admin'` ya existen en el enum (lo confirmaré antes de la migración con un `\dT+ public.app_role`).
- **RLS**: el trigger corre como SECURITY DEFINER, por lo que bypassa RLS para crear `organizations` y `organization_members`. Sin esto el INSERT fallaría porque el usuario aún no es miembro de ninguna org.
- **Confirmación de email**: el trigger dispara en el `INSERT` (antes de confirmar). Esto es correcto: la organización ya existe cuando el usuario abre el link de confirmación e inicia sesión.
- **Validación servidor**: el campo `company_name` se trimea y se acota a 120 chars dentro de la función plpgsql para defensa en profundidad.
- **No rompe usuarios actuales**: la migración solo afecta nuevos INSERT en `auth.users`. Usuarios ya creados (incluidos los de `seguridad-y-roles`) no se tocan.

## Estructura del flujo nuevo

```text
Usuario llena formulario (nombre + empresa + email + pass)
        ↓
supabase.auth.signUp(metadata={full_name, company_name})
        ↓ INSERT en auth.users
TRIGGER on_auth_user_created → handle_new_user_signup()
        ├── crea public.organizations
        ├── crea public.organization_members (role=admin)
        └── crea public.user_roles  (role=super_admin si primero, sino admin)
        ↓
Email de confirmación → Usuario lo abre → /inicio
        ↓
AuthContext + OrganizationContext detectan la org → acceso operativo
```

## Archivos a tocar

- `src/pages/auth/components/SignupForm.tsx` (campo + estado + submit)
- `src/services/auth/index.ts` (firma + metadata)
- Nueva migración SQL (función + trigger)
- `src/constants/appVersion.ts` → `13.45.0`
- `CHANGELOG.md` → entrada nueva arriba

## Fuera de alcance (lo dejamos para después si lo quieres)

- Captura de RFC, dirección fiscal o logo en el wizard de signup.
- Onboarding multi-paso (tour, configuración inicial guiada).
- Auto-asignación por dominio de email (que dos usuarios `@acme.com` caigan en la misma org).
- Sign-in con Google.

¿Procedo con esta implementación?