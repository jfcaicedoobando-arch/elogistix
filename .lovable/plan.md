# Guard: embarque debe nacer de una cotización

Solo `super_admin`, `admin_org`, `admin` y `gerente_operaciones` podrán seguir creando embarques "libres" (sin cotización). El resto de roles operativos (`coordinador_logistico`, `operador`, `ejecutivo_pricing`) deberán vincular una cotización Aceptada antes de avanzar del Paso 1 del wizard.

Punto único de bloqueo: **Paso 1 del wizard de Nuevo Embarque** (UI). No se tocan rutas, RLS ni backend.

## Cambios

### 1. `src/hooks/shared/usePermissions.ts`
- Agregar nueva capacidad `canCrearEmbarqueLibre` (lista: `super_admin`, `admin_org`, `admin`, `gerente_operaciones`). Devolverla en el objeto del hook.

### 2. `src/features/embarques/components/StepDatosGenerales.tsx`
- Consumir `usePermissions().canCrearEmbarqueLibre`.
- Si es `false` y no hay `cotizacionVinculada`:
  - Mostrar `Alert` informativo arriba del selector de cotización: *"Tu rol requiere iniciar el embarque desde una cotización Aceptada. Selecciona una para continuar."*
  - Ocultar/deshabilitar el bloque de "modo expediente" y los campos de cliente manual hasta que se vincule cotización (el cliente se hereda de la cotización al vincular, igual que hoy).

### 3. `src/features/embarques/domain/embarqueWizardStepValidator.ts` (validador del Paso 1)
- Recibir como parámetro `requiereCotizacion: boolean`.
- Si `true` y `cotizacionVinculadaId` está vacío → devolver error `cotizacion: "Debes vincular una cotización Aceptada para continuar"`. Esto bloquea el botón Siguiente.

### 4. `src/features/embarques/hooks/useNuevoEmbarqueWizard.ts`
- Leer `canCrearEmbarqueLibre` y pasarlo (negado) como `requiereCotizacion` al `validateStep(1)`.

### 5. Pruebas mínimas
- Caso 1: `coordinador_logistico` sin cotización → `validateStep(1)` falla con error en `cotizacion`.
- Caso 2: `admin` sin cotización → `validateStep(1)` pasa (manteniendo regla actual de cliente requerido).
- Caso 3: `coordinador_logistico` con cotización vinculada → `validateStep(1)` pasa.

### 6. Versionado
- `APP_VERSION` → `13.39.0` (cambio de comportamiento de permisos = bump menor).
- Entrada en `CHANGELOG.md` describiendo la nueva regla y los roles afectados.

## Lo que NO cambia
- Ruta `/embarques/nuevo` sigue accesible para los mismos roles que hoy (no se redirige).
- RLS / políticas de la tabla `embarques` no se tocan.
- Botón "Crear embarque" del detalle de cotización (v13.38.0) ya pasa la cotización pre-vinculada, así que para coordinadores sigue funcionando sin fricción.
- Edición de embarques existentes (`/embarques/:id/editar`) no se ve afectada.
