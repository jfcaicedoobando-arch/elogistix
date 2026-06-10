## Objetivo
Evitar que se den de alta proveedores duplicados (mismo RFC/Tax ID dentro de la misma organización), con aviso temprano en el wizard y red de seguridad a nivel base de datos.

## Cambios

### 1. Base de datos (migración)
- Añadir índice único `UNIQUE (organization_id, upper(trim(rfc)))` en `public.proveedores`.
  - Normaliza para que `"raaa010101aaa"` y `"  RAAA010101AAA  "` cuenten como el mismo.
  - Scope por organización: cada tenant tiene su propio catálogo.
- Antes de crear el índice, detectar duplicados existentes y abortar la migración con mensaje claro si los hay (no auto-mergeamos: requiere decisión del usuario). Si no hay duplicados, crea el índice.

### 2. Servicio (`src/services/proveedor/index.ts`)
- Nueva función `checkProveedorExistente(rfc, organizationId)`:
  - `SELECT id, nombre, tipo FROM proveedores WHERE organization_id = ? AND upper(trim(rfc)) = upper(trim(?)) LIMIT 1`.
- En `insertProveedor`: capturar error `23505` (unique_violation) y relanzar un error tipado `ProveedorDuplicadoError` con `{ id, nombre }` del existente, para que la UI pueda enlazar.

### 3. Wizard de nuevo proveedor (aviso suave)
- En `useNuevoProveedorController`: al `onBlur` del campo RFC/Tax ID del paso 1, si tiene formato válido, consultar `checkProveedorExistente`.
- Si existe, mostrar un banner `Alert` (variant warning) bajo el campo:
  > "Ya existe un proveedor con este RFC en tu organización: **{nombre}**. [Ver proveedor]"
  - El link abre `/proveedores/{id}` en nueva pestaña.
  - El usuario puede ignorar y seguir (no bloquea avance del wizard); el bloqueo real ocurre al guardar.
- Debounce 300ms para no spammear queries.

### 4. Manejo de error al guardar (bloqueo duro)
- En el `submit` final del wizard y en `CrearProveedorDesdeCfdiDialog`: si `insertProveedor` lanza `ProveedorDuplicadoError`, mostrar `toast` de error con el mismo CTA "Ver proveedor" y dejar el wizard abierto.

### 5. Versionado
- Bump `APP_VERSION` → `12.76.24`.
- Entrada en `CHANGELOG.md` raíz: "Prevención de proveedores duplicados (aviso en wizard + restricción única por RFC)."

## Notas técnicas
- El índice es funcional (`upper(trim(rfc))`), por lo que requiere `IMMUTABLE` — `upper` y `trim` lo son, OK.
- La RLS existente sigue aplicando para el lookup del aviso suave (sólo ve proveedores de su org), así que el aviso no filtra datos cross-tenant.
- Si `rfc` viene vacío (no debería, es obligatorio), no se ejecuta el check.
- Se conserva la lógica actual de validación de formato; sólo agregamos la verificación de unicidad.

## Archivos afectados
- `supabase/migrations/<timestamp>_proveedores_unique_rfc.sql` (nuevo)
- `src/services/proveedor/index.ts`
- `src/hooks/proveedor/useNuevoProveedorController.ts`
- `src/components/proveedor/NuevoProveedorDialog.tsx` (banner de aviso)
- `src/components/cxp/CrearProveedorDesdeCfdiDialog.tsx` (manejo de error duplicado)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`
