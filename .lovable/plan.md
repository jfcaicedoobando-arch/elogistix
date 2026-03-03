

## Plan: Desacoplar cotizaciones de embarques

### Resumen
Eliminar toda lógica que vincule cotizaciones con embarques: funciones de conversión, botones de "Crear Embarque", links a embarques, y el estado "Confirmada". Las cotizaciones tendrán un flujo de estados independiente: Borrador → Enviada → Aceptada/Rechazada/Vencida.

### Cambios

**1. `src/hooks/useCotizaciones.ts`**
- Eliminar `useCrearEmbarqueDesdeCotizacion` completa (~100 líneas)
- Eliminar `useConfirmarCotizacion` (alias deprecated)
- Eliminar `embarque_id` de `CotizacionRow`
- Limpiar imports no usados (`useAuth`, queries de embarques)

**2. `src/pages/CotizacionDetalle.tsx`**
- Eliminar import y uso de `useCrearEmbarqueDesdeCotizacion`
- Eliminar `handleCrearEmbarque` y el `AlertDialog` de "Crear Embarque" (líneas 152-172)
- Eliminar el card verde de "Embarque creado" con link (líneas 177-187)
- Eliminar variables `esConfirmada`,

<lov-plan>

## Plan: Desacoplar cotizaciones de embarques

### Resumen
Eliminar toda lógica que vincule cotizaciones con embarques: funciones de conversión, botones de "Crear Embarque", links a embarques, y el estado "Confirmada". Las cotizaciones tendrán un flujo de estados independiente: Borrador → Enviada → Aceptada/Rechazada/Vencida.

### Cambios

**1. `src/hooks/useCotizaciones.ts`**
- Eliminar `useCrearEmbarqueDesdeCotizacion` completa (~100 líneas)
- Eliminar `useConfirmarCotizacion` (alias deprecated)
- Eliminar `embarque_id` de `CotizacionRow`
- Limpiar imports no usados (queries de embarques)

**2. `src/pages/CotizacionDetalle.tsx`**
- Eliminar import y uso de `useCrearEmbarqueDesdeCotizacion`
- Eliminar `handleCrearEmbarque` y el `AlertDialog` de "Crear Embarque" (líneas 152-172)
- Eliminar el card verde de "Embarque creado" con link a embarque (líneas 177-187)
- Eliminar variables `esConfirmada`, imports de `Ship`, `Anchor`, `Link`

**3. `src/pages/Cotizaciones.tsx`**
- Eliminar "Confirmada" del array `ESTADOS`
- El import de `useClientesForSelect` viene de `useEmbarques` — moverlo a un import propio desde `useClientes` (o dejarlo si `useClientes` ya lo expone)

**4. `src/pages/NuevaCotizacion.tsx`**
- Verificar que no hay referencias a embarques (revisado: no hay, solo usa `useClientesForSelect` de embarques — mismo caso que punto 3)

**5. `src/pages/Changelog.tsx`**
- Nueva entrada v4.3.0 (minor: cambio funcional significativo) documentando la desconexión

### Sin cambios en BD
No se elimina la columna `embarque_id` de la tabla `cotizaciones` para evitar romper datos existentes. Solo se deja de usar en el código.

### Flujo de estados resultante
Borrador → Enviada → Aceptada / Rechazada / Vencida (sin "Confirmada")

