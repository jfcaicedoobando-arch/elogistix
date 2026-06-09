# Fix permisos regresivos para roles modernos

## Causa raíz

Tras introducir los nuevos roles organizacionales, dos guardas no respetan el **agrupador** que ya implementa `public.has_role()`:

1. **Frontend — `ProtectedRoute`** compara `allowedRoles.includes(effectiveRole)` con **igualdad exacta**. La ruta `/usuarios` está protegida con `allowedRoles={["admin"]}`. El `effectiveRole` de Hector es `admin_org` (viene de `organization_members.role`), así que **no entra**. Mismo problema en `/configuracion`, `/idempotencia` y el resto de rutas con `["admin","super_admin"]`.

2. **BD — `public.can_manage_document_object`** (usada por las políticas INSERT/UPDATE/DELETE del bucket `documentos`) compara contra `user_roles.role IN ('admin','operador')` y `organization_members.role IN ('admin','operador')` **directamente**, sin pasar por `has_role()`. Valeria tiene rol `coordinador_logistico`, que el agrupador moderno trata como `operador` — pero esta función lo ignora, por eso le rechaza la subida.

## Fix

### 1. `ProtectedRoute` (`src/components/auth/ProtectedRoute.tsx`)

Reemplazar el `includes` exacto por un helper `roleSatisfies(required, actual)` que replique la jerarquía del `has_role()` de la BD:

- `super_admin` ⇒ sólo `super_admin`.
- `admin` ⇒ `admin | admin_org | super_admin`.
- `admin_org` ⇒ `admin_org | super_admin`.
- `operador` ⇒ `operador | coordinador_logistico | ejecutivo_pricing | gerente_operaciones | admin | admin_org | super_admin`.
- `viewer` ⇒ todos los anteriores + `customer_service | vendedor | contador | tesorero`.
- `vendedor` ⇒ `vendedor | admin_org | super_admin`.
- Cualquier otro ⇒ igualdad exacta.

La ruta es válida si **alguno** de los roles permitidos se satisface con `effectiveRole`. El helper vive en `src/lib/auth/roleHierarchy.ts` (puro, con test unitario) para reutilizarlo si más adelante hay otros guardas en componentes.

No se tocan las listas `allowedRoles` de las rutas: ya están bien escritas en términos del rol "lógico" que se requiere; el problema es la comparación.

### 2. `public.can_manage_document_object` (migración)

Recrear la función para que el chequeo del actor y el del `organization_members` usen `public.has_role()` en lugar de `IN ('admin','operador')`:

- `is_staff` ⇒ `public.has_role(auth.uid(), 'operador')` (el agrupador ya incluye admin/admin_org/super_admin/coordinador_logistico/ejecutivo_pricing/gerente_operaciones).
- En la subconsulta de `organization_members`, sustituir `om.role IN ('admin','operador')` por `public.has_role(om.user_id, 'operador')` (parametrizado al mismo usuario), manteniendo el join contra `embarques` para validar tenencia.

No se cambian las políticas del bucket; basta con corregir la función `SECURITY DEFINER`.

### 3. Versionado y bitácora

- `APP_VERSION` → `12.68.1` (patch: regresión de permisos).
- Entrada en `CHANGELOG.md` describiendo ambos fixes y los usuarios afectados.

## Validación

- Login con Hector (`admin_org`) → entra a `/usuarios`, `/configuracion`, `/idempotencia`.
- Login con Valeria (`coordinador_logistico`) → puede subir documento a un embarque de su organización.
- Super admin sigue accediendo a todo; cliente sigue redirigido a `/portal`.
- Test unitario nuevo para `roleSatisfies` cubriendo cada rama del switch.

## Fuera de alcance

- Auditar otras funciones SECURITY DEFINER que aún hagan `IN ('admin','operador')` directo (puede haber más; lo dejo para una pasada dedicada — abrir nota en `mem://audit/pendings`).
- Cambiar los `allowedRoles` literales de cada ruta (no es necesario con el helper).
