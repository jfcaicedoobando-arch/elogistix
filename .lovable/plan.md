# Plan: Bitácora más descriptiva

## Problema actual

`BitacoraActividad` muestra entradas genéricas tipo:

> *Juan — cambiar estado en Embarques — EXP-001 · hace 2h*

Pero en la BD ya guardamos contexto rico en `detalles` (JSONB) que no se está aprovechando:

- `cambiar_estado` → `{ estado_anterior, estado_nuevo }`
- `crear/editar` (embarques) → `{ modo, tipo, cliente, cotizacion_folio }`
- `subir_documento` / `eliminar_documento` → nombre del documento
- `factura` → folio, monto
- `agregar_nota` → preview de la nota

## Cambios propuestos

### 1. Nuevo helper `src/lib/domain/bitacoraDescripcion.ts`

Función pura `describirEntrada(entrada: EntradaBitacora): { titulo: string; contexto?: string }` con un switch por `accion + modulo`:

| Acción | Salida ejemplo |
|---|---|
| `cambiar_estado` en `embarques` | **"Cambió estado de Arribo → En Aduana"** |
| `crear` en `embarques` | **"Creó embarque marítimo de importación"** · contexto: cliente |
| `editar` en `embarques` | **"Editó embarque"** · contexto: cliente + modo |
| `subir_documento` | **"Subió {tipo_doc}"** |
| `eliminar_documento` | **"Eliminó {tipo_doc}"** |
| `agregar_nota` | **"Agregó nota:"** + preview 80 chars |
| `factura` | **"Generó factura {folio}"** + monto formateado |
| `crear` en `clientes/proveedores/cotizaciones` | **"Creó {entidad}"** |
| `login` | **"Inició sesión"** |
| fallback | comportamiento actual (acción + módulo capitalizado) |

Pruebas unitarias en `__tests__/bitacoraDescripcion.test.ts` cubriendo cada rama.

### 2. Rediseño de `BitacoraActividad.tsx`

Layout por entrada:

```text
[icono]  Juan · hace 2h
         Cambió estado de Arribo → En Aduana
         en Embarques — EXP-001
```

- Línea 1: usuario + tiempo relativo (timestamp en tooltip).
- Línea 2: `titulo` descriptivo (texto principal, foreground).
- Línea 3: módulo + link a entidad (más sutil, muted).
- Para `cambiar_estado`, renderizar los dos estados como badges con colores de `estadoConfig` (estado_anterior con opacity baja + flecha + estado_nuevo).
- Mantener iconos y colores actuales (`ICONOS_ACCION`, `COLORES_ACCION`).
- Conservar `mostrarUsuario` y el comportamiento de link a entidad por módulo.

### 3. Filtros adicionales en `pages/dashboard/Bitacora.tsx`

- **Filtro por acción** (nuevo Select): Todas / Crear / Editar / Eliminar / Cambio de estado / Documentos / Notas.
- **Filtro por usuario** (solo admin): Select poblado con `usuario_email` distintos de la página actual.
- **Filtro por rango de fechas** ya soportado en `fetchBitacora` (`fechaDesde/fechaHasta`) — agregar `DateRangePicker` simple con presets: Hoy / 7 días / 30 días / Todo.
- Reset paginación al cambiar cualquier filtro (patrón existente).

Extender `FiltrosBitacora` con `accion?: string` y aplicar `.eq("accion", accion)` en `services/bitacora`.

### 4. Reutilización

`BitacoraActividad` se usa también en otras vistas (detalle de embarque/cliente). El nuevo render es retrocompatible — la prop sigue siendo `actividades: EntradaBitacora[]`.

## Fuera de alcance

- Cambios al esquema de `bitacora_actividad` o a cómo se escriben los `detalles` (ya están bien estructurados).
- Export CSV de la bitácora.
- Diff visual completo de campos editados (solo mostramos los detalles ya guardados).

## Detalle técnico

- Archivos nuevos: `src/lib/domain/bitacoraDescripcion.ts` + test.
- Editados: `src/components/shared/BitacoraActividad.tsx`, `src/pages/dashboard/Bitacora.tsx`, `src/services/bitacora/index.ts`, `src/hooks/shared/useBitacora.ts` (pasar `accion` por el filtro).
- Versión: **8.137.0** (minor — feature visible). Entrada nueva en `Changelog.tsx` + `changelog/v8/chunks/0.ts` + `changelogData.ts`.
- Sin migraciones, sin cambios a RLS, sin cambios a hooks de negocio.
