

## Plan: Flujo Prospecto/Cliente en Cotizaciones — v3.7.0

### 1. Migración de base de datos

Agregar campos de prospecto a `cotizaciones` y nuevo valor al enum:

```sql
-- Nuevo estado "Aceptada"
ALTER TYPE public.estado_cotizacion ADD VALUE 'Aceptada';

-- Campos de prospecto
ALTER TABLE public.cotizaciones ADD COLUMN es_prospecto boolean NOT NULL DEFAULT false;
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_empresa text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_contacto text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_email text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_telefono text NOT NULL DEFAULT '';

-- Permitir cliente_id nullable (prospectos no tienen cliente aún)
ALTER TABLE public.cotizaciones ALTER COLUMN cliente_id DROP NOT NULL;
```

### 2. `src/hooks/useCotizaciones.ts`

- Actualizar `CotizacionRow` con los nuevos campos (`es_prospecto`, `prospecto_empresa`, etc.)
- Actualizar `CreateCotizacionInput` para aceptar datos de prospecto con `cliente_id` opcional
- Actualizar `useConfirmarCotizacion` para que no cree embarque directamente al confirmar. Renombrar la lógica: al "Aceptar", solo cambia estado a "Aceptada". La creación de embarque se hace con un nuevo hook `useCrearEmbarqueDesdeCotizacion`
- Nuevo hook `useConvertirProspectoACliente`: crea el cliente en la tabla `clientes`, actualiza la cotización con el `cliente_id` resultante y `es_prospecto = false`, registra en bitácora

### 3. `src/pages/NuevaCotizacion.tsx`

- Agregar selector inicial con radio buttons: "Cliente existente" / "Prospecto"
- Si **cliente existente**: mostrar Select de clientes (flujo actual)
- Si **prospecto**: mostrar 4 campos (empresa, contacto, email, teléfono)
- Ajustar validación: si es prospecto, no requiere `cliente_id`; requiere empresa y contacto

### 4. `src/pages/CotizacionDetalle.tsx`

Cambiar el flujo de acciones según el estado:

- Estados Borrador/Enviada: botones Enviar, Rechazar, **Aceptar** (antes "Confirmar")
- Al aceptar: solo cambia estado a "Aceptada" (sin crear embarque aún)
- Cuando estado = "Aceptada":
  - Si `es_prospecto = false` (cliente existente): mostrar botón **"Crear Embarque"** que ejecuta la conversión a embarque
  - Si `es_prospecto = true`: mostrar botón **"Convertir a Cliente"** que abre un Dialog con formulario de nuevo cliente pre-llenado (nombre=prospecto_empresa, contacto, email, teléfono). Al guardar, se crea el cliente y se actualiza la cotización. Luego aparece el botón "Crear Embarque"
- Estado "Confirmada": mostrar link al embarque creado (flujo actual)

### 5. Lista de Cotizaciones (`src/pages/Cotizaciones.tsx`)

- Agregar "Aceptada" al array de estados para el filtro
- Agregar color para "Aceptada" (amarillo/ámbar)

### 6. Changelog

- Nueva entrada v3.7.0

### Archivos modificados
- `src/hooks/useCotizaciones.ts` — nuevos hooks, campos actualizados
- `src/pages/NuevaCotizacion.tsx` — selector prospecto/cliente
- `src/pages/CotizacionDetalle.tsx` — flujo Aceptada con conversión
- `src/pages/Cotizaciones.tsx` — estado Aceptada en filtros
- `src/pages/Changelog.tsx` — v3.7.0

### Detalle técnico

Flujo de estados actualizado:
```text
Borrador → Enviada → Aceptada → Confirmada (con embarque)
                  ↘ Rechazada
```

Al "Aceptar" no se crea embarque. Al hacer clic en "Crear Embarque" (desde Aceptada), se ejecuta la lógica existente de `useConfirmarCotizacion` y el estado pasa a "Confirmada".

Para prospectos, el flujo agrega un paso intermedio:
```text
Aceptada → [Convertir a Cliente] → [Crear Embarque] → Confirmada
```

