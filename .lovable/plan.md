## Problema

1. **Permisos parse-csf**: La edge function `parse-csf` exige admin global o admin de organización (`checkAdminAccess`). Roles como `contador` (e Isela) reciben **403 "Solo administradores y operadores pueden usar este servicio"** al subir CSF, aunque pueden crear proveedores.

2. **CSF en proveedores logísticos nacionales**: El botón "Subir CSF" sólo aparece cuando la categoría es **Gasto Operativo** (`c.isGasto`). En **Logístico + Nacional** (que sí tiene RFC mexicano) no se ofrece la carga automática.

## Cambios

### 1. Relajar permisos en `parse-csf` (`supabase/functions/parse-csf/index.ts`)

Reemplazar el gate `checkAdminAccess` por una verificación más laxa: **basta con que el usuario esté autenticado y pertenezca a una organización** (cualquier rol). Esto es consistente con quién puede crear proveedores (contador, coordinador_logistico, admin_org, etc.). Implementación:

- Quitar la llamada a `checkAdminAccess`.
- Consultar `organization_members` por `user_id`; si no hay membresía → 403.
- Mantener el JWT obligatorio (no anónimo) para evitar drenaje de créditos Gemini.
- Loggear `user_id` y `organization_id` resuelto.

No se amplían roles "admin"; se cambia la política a "miembro autenticado de org", que es la audiencia correcta de la herramienta.

### 2. Habilitar CSF en proveedores Logísticos Nacionales

**`src/components/proveedor/NuevoProveedorDialog.tsx`**:
- Cambiar la condición del bloque de carga CSF de `c.isGasto` a `c.isGasto || (c.isLogistico && c.form.origen_proveedor === "Nacional")`.
- Mover el bloque para que aparezca **después** de seleccionar Origen (ya que para logístico depende de "Nacional"), pero antes del campo Nombre.
- Texto: "Opcional. Extraemos automáticamente nombre y RFC desde la CSF del SAT."

No requiere cambios en `useNuevoProveedorController.handleCsfUpload` — ya rellena `nombre` y `rfc` y aplica a cualquier categoría.

### 3. Versionado y changelog

- `APP_VERSION` → `12.76.11`
- `CHANGELOG.md` (root): entrada `## [12.76.11] - 2026-06-10` con bullets:
  - Fix: `parse-csf` ahora permite a cualquier miembro de organización (contador, coordinador, etc.) usar la extracción de CSF.
  - Mejora: el alta de proveedores logísticos nacionales ofrece carga de CSF para autollenar nombre y RFC.

## Archivos a tocar

- `supabase/functions/parse-csf/index.ts` (lógica de auth)
- `src/components/proveedor/NuevoProveedorDialog.tsx` (UI condicional)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Fuera de alcance

- No cambia el enum `app_role` ni RLS.
- No toca `checkAdminAccess` (otras funciones siguen usándolo).
- No modifica el flujo de gasto operativo existente.
