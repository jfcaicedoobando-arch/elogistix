# Cargar costos desde el tab Costos vacío

## Objetivo
En el detalle del embarque, dentro del tab **Costos**, cuando no hay conceptos cargados el usuario verá el `EmptyState` (icono circular con archivo). Hacer clic en ese estado vacío debe llevar directamente al wizard de edición posicionado en el paso 3 (Costos y Pricing) para capturar los costos.

## Alcance
- Solo afecta el detalle de embarque → `TabCostos` y `EditarEmbarque`.
- Sin cambios de lógica de negocio ni de BD.

## Cambios

### 1. `src/components/embarque/TabCostos.tsx`
- Aceptar dos nuevos props opcionales: `embarqueId: string` y `canEdit: boolean`.
- Convertir el `EmptyState` de **Conceptos de Costo** (y, por consistencia, el de **Conceptos de Venta**) en accionable cuando `canEdit`:
  - Agregar `primaryAction={{ label: "Cargar costos", onClick: () => navigate(\`/embarques/${embarqueId}/editar?step=3\`) }}`.
  - El icono `FileText`/`Receipt` ya actúa como el "círculo con icono de archivos" del EmptyState; el botón primario queda inmediatamente debajo. Adicionalmente envolver el icono con `role="button"` + handler para que también sea clickeable directamente.

### 2. `src/pages/embarques/EditarEmbarque.tsx`
- Leer `step` de `useSearchParams`. Si viene un valor válido (1, 2, 3), inicializar `currentStep` con ese valor mediante un `useEffect` que corre una sola vez tras montar.

### 3. `src/pages/embarques/EmbarqueDetalle.tsx`
- Pasar `embarqueId={id!}` y `canEdit` a `<TabCostos />`.

### 4. Versionado y changelog
- Bump a **8.225.0** en `src/constants/appVersion.ts`.
- Nueva entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` describiendo la acción rápida para cargar costos desde el tab.

## Validaciones
- Sin permiso de edición, el EmptyState se queda informativo (sin acción), respetando RLS de UI.
- El deep-link `?step=3` no rompe la navegación si el valor es inválido (fallback a 1).

## Fuera de alcance
- No se cambia el flujo de captura de costos ni se añade un editor inline en el detalle.
