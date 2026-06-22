## Bug

Al crear un proveedor (nacional o internacional) aparecen **dos toasts** de éxito apilados:

1. `useProveedores.ts` línea 63 — el `onSuccess` de la mutación `addProveedorMutation` lanza `"Proveedor creado"`.
2. `useProveedoresCrear.ts` línea 30 — el wrapper que usa la página `Proveedores` lanza además `"Proveedor creado correctamente"` tras el `await`.

Analogía: es como si el horno sonara cuando termina el pan, y además el panadero gritara "¡listo!" — dos avisos para el mismo evento.

El mismo doble toast ocurre en `CrearProveedorDesdeCfdiDialog.tsx` (línea 51 lanza `"Proveedor creado"` después del `await addProveedor`).

## Fix

Quitar el toast del `onSuccess` dentro de la mutación y dejar que cada call site (que ya tiene contexto del flujo: creación normal, vinculación desde CFDI, etc.) emita su propio mensaje. Es el patrón ya usado para los toasts de error (el wrapper decide).

### Cambios

1. **`src/features/proveedor/hooks/useProveedores.ts`** — eliminar la línea `notifySuccess(undefined, { title: "Proveedor creado" })` del `onSuccess` de `addProveedorMutation`. Conservar la invalidación de queries.

2. **Versionado**
   - `src/constants/appVersion.ts` → `13.105.1`
   - `CHANGELOG.md` → entrada `## [13.105.1]` describiendo el fix de doble toast al crear proveedor.

### Fuera de alcance

- No se tocan los toasts de `updateProveedor` / `deleteProveedor` (no presentan el bug porque sus call sites no duplican el toast).
- No se cambia el texto de los mensajes existentes en los call sites.

### Verificación

- Crear un proveedor internacional desde el wizard → debe aparecer un solo toast `"Proveedor creado correctamente"`.
- Crear proveedor desde el diálogo CFDI → un solo toast `"Proveedor creado"`.
