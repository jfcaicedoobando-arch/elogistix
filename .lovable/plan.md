

## Plan: Permitir editar cotizaciones en estado Borrador

### Alcance
Crear una página `EditarCotizacion` que reutilice el wizard de 4 pasos existente (`useCotizacionWizardForm`), pre-llenando los campos desde la cotización guardada. Solo accesible cuando `estado === 'Borrador'` y `canEdit === true`.

### Cambios

**1. `src/hooks/useCotizacionWizardForm.ts`**
- Agregar parámetro opcional `initialData` (cotización existente) y `initialCostos` (costos guardados) al hook
- Si `initialData` está presente: pre-llenar `defaultValues` del form, `cotizacionId`, `conceptosUSD/MXN` y `costosInternos`
- Cambiar `handleGuardar` para que no cambie el estado a "Borrador" si ya es edición (mantener estado actual)
- Registrar acción "editar" en bitácora en vez de "crear"

**2. `src/pages/EditarCotizacion.tsx`** (nuevo)
- Recibir `id` por params, cargar cotización con `useCotizacion(id)` y costos con `useCotizacionCostos(id)`
- Validar que `estado === 'Borrador'`, si no redirigir al detalle
- Pasar `initialData` e `initialCostos` al hook `useCotizacionWizardForm`
- Reutilizar el mismo JSX de `NuevaCotizacion` (wizard 4 pasos) con título "Editar Cotización"

**3. `src/App.tsx`**
- Agregar ruta `/cotizaciones/:id/editar` → `EditarCotizacion`

**4. `src/pages/CotizacionDetalle.tsx`**
- Agregar botón "Editar" (icono Pencil) visible cuando `canEdit && estado === 'Borrador'`
- Navega a `/cotizaciones/${id}/editar`

**5. `src/pages/Changelog.tsx`** — Registrar v4.43.0

### Mapeo de campos DB → Form
Los campos de la cotización se mapean inversamente al `buildPaso1Data`:
- `es_prospecto` → `esProspecto`, `cliente_id` → `clienteId`, etc.
- `conceptos_venta` (JSON) → separar en `conceptosUSD` y `conceptosMXN`
- `cotizacion_costos` → `costosInternos` (FilaCostoLocal[])
- `validez_propuesta` (string date) → `Date`

