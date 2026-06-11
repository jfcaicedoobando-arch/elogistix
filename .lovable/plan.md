# Plan: Agregar funcionalidad de editar tarifas marítimas

## Contexto
Actualmente en `/costeo/tarifas` solo se puede crear, duplicar (crea una nueva) y eliminar tarifas. No existe la opción de **editar una tarifa existente**.

## Alcance
Agregar un botón de editar en cada fila de la tabla de tarifas que abra el formulario con los datos precargados y permita guardar los cambios en la misma tarifa (incluyendo sus recargos).

## Cambios propuestos

### 1. Servicio de actualización (`src/features/costeo/services/tarifas.ts`)
- Crear función `updateTarifaConRecargos(id: string, input: TarifaInput)` que:
  - Haga `update` de la fila en `costeo_tarifas`
  - Sincronice recargos: eliminar los existentes e insertar los nuevos (delete + insert para mantener consistencia)
  - Todo dentro de la misma organization

### 2. Hook de mutaciones (`src/features/costeo/hooks/useCosteoTarifas.ts`)
- Agregar mutación `actualizar` usando `useMutation` que llame a `updateTarifaConRecargos`
- Invalidar el query de tarifas en `onSuccess`
- Mostrar toast de confirmación/error

### 3. Formulario de tarifa (`src/features/costeo/components/TarifaForm.tsx`)
- Aceptar prop opcional `tarifaId?: string` para modo edición
- Cuando se recibe `tarifaId`, el título cambia a "Editar tarifa marítima"
- Usar `actualizar.mutate` en lugar de `crear.mutate` cuando hay `tarifaId`
- Precargar **todos** los campos de la tarifa existente (incluyendo `vigente_desde`, `vigente_hasta`, `flete_base`, etc.) — no solo los valores por default
- El botón de guardar cambia a "Guardar cambios"

### 4. Tabla de tarifas (`src/features/costeo/routes/CosteoTarifas.tsx`)
- Agregar botón de editar (icono `Pencil`) junto a los existentes de duplicar y eliminar
- Al hacer clic, precargar el formulario con **todos** los datos de la tarifa seleccionada (incluyendo recargos) y pasar el `id`
- Mantener el botón de duplicar existente (que no pasa `id`, solo precarga datos para crear nueva)

### 5. Changelog y versión
- Actualizar `APP_VERSION` a `12.77.10`
- Agregar entrada en `CHANGELOG.md` describiendo la nueva funcionalidad

## Detalles técnicos
- No se requiere migración de base de datos; las tablas ya soportan UPDATE a través de RLS
- Los recargos se manejan como colección hija (tabla `costeo_tarifa_recargos` con FK a `costeo_tarifas`)
- Se mantiene el patrón de duplicar intacto: duplicar sigue creando una nueva tarifa
- El formulario sigue usando el mismo componente `TarifaForm` en modo dual (crear vs editar)