## Problema

En el diálogo **Editar factura** el bloque de proveedor sale duplicado y contradictorio:

1. Banner gris superior: "PROVEEDOR (NO EDITABLE) — COSCO SHIPPING LINES…"
2. Inmediatamente debajo, sección "Proveedor y folio" con un **combobox de proveedor** que visualmente parece editable (cursor pointer, ícono chevron).

Causa: el dialog reusa `FacturaProveedorFormFields`, que siempre renderiza el `ProveedorCombobox`. En modo edición no hay forma de ocultarlo.

## Solución

Pequeña refactor visual sin tocar lógica de negocio.

### 1) `src/features/cxp/components/FacturaProveedorFormFields.tsx`
- Agregar prop opcional `proveedorReadOnly?: boolean` (default `false`).
- Cuando es `true`:
  - Cambiar el título de la sección de "Proveedor y folio" → **"Folio del proveedor"**.
  - Reemplazar el `<ProveedorCombobox>` por una línea estática read-only: chip pequeño `Proveedor: <nombre>` con `bg-muted` y `text-muted-foreground`, sin chevron ni cursor pointer. Mantiene el contexto pero deja claro que no es interactivo.
  - El input de Folio toma la columna completa (deja de ser grid 2-col).
- Comportamiento por default (modo crear) sin cambios.

### 2) `src/features/cxp/components/DialogEditarFacturaProveedor.tsx`
- Eliminar el banner separado "PROVEEDOR (NO EDITABLE) — …" (ahora la sección del form ya lo comunica).
- Pasar `proveedorReadOnly={true}` a `<FacturaProveedorFormFields>`.
- Mantener banners amarillo (tiene pagos) y azul (requiere re-aprobación).

### 3) Versionado
- `src/constants/appVersion.ts`: `13.107.0` → `13.107.1`.
- `CHANGELOG.md`: entry breve "fix(cxp/editar): elimina el combobox de proveedor en el modal de edición — ahora se muestra como campo read-only y desaparece el banner duplicado".

## Verificación

- Tomar screenshot del modal después del cambio: debe haber **un solo** indicador de proveedor (read-only) y debajo el folio editable a todo lo ancho.
- Modal de **Capturar factura** (`Nueva`) debe verse igual que antes (sin regresiones).

## Fuera de scope

No tocar el flujo de negocio, ni las validaciones, ni el banner amarillo/azul. Sólo el bloque de proveedor.

## Analogía 🩹

Era como un letrero que dice "NO TOCAR" pegado encima de un botón rojo que parece presionable. Vamos a quitar el botón y dejar sólo el letrero, así nadie duda.
