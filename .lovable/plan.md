# Fix CI: mutaciones de plantillas sin `onError`

## Diagnóstico

El log de CI adjunto (shard 15/20) muestra un único test fallando en `main`:

```
FAIL src/__tests__/architecture/mutations-have-onerror.test.ts
Error: Se encontraron 1 archivos con useMutation sin onError:
  - src/features/cotizacion/hooks/useCotizacionPlantillas.ts (líneas: 79, 107, 125)
```

**Analogía:** cada `useMutation` de la app es como un carrito del súper con seguro obligatorio: si no le pones "qué hacer si choca" (`onError`), el guardrail de CI te lo marca. En `useCotizacionPlantillas.ts` (P2 — plantillas de cotización) las 4 mutaciones (guardar, aplicar, eliminar, actualizar) sólo definen `onSuccess`, así que el error del backend queda mudo para el usuario.

## Cambios

### 1. `src/features/cotizacion/hooks/useCotizacionPlantillas.ts`

Agregar `onError` con `notifyError(...)` a las 4 mutaciones, siguiendo el patrón ya usado en `useCotizacionConversions.ts` / `useVersionadoCotizacion.ts`:

- `useGuardarPlantilla` → `title: "No se pudo guardar la plantilla"`, `method: "COTIZACION_PLANTILLA_GUARDAR"`.
- `useAplicarPlantilla` → `title: "No se pudo aplicar la plantilla"`, `method: "COTIZACION_PLANTILLA_APLICAR"`.
- `useEliminarPlantilla` → `title: "No se pudo eliminar la plantilla"`, `method: "COTIZACION_PLANTILLA_ELIMINAR"`.
- `useActualizarPlantilla` → `title: "No se pudo actualizar la plantilla"`, `method: "COTIZACION_PLANTILLA_ACTUALIZAR"`.

Todos usarán `notifyError(undefined, { title, description: getErrorMessage(error), error, method })`. Importar `notifyError` desde `@/components/shared/utils/appFeedback` y `getErrorMessage` desde `@/lib/errors`.

### 2. `src/constants/appVersion.ts`

Bump a `13.297.2`.

### 3. `CHANGELOG.md`

Nueva entrada `## [13.297.2] - 2026-07-13` con bullet:
- **fix(cotización/plantillas)**: agregado `onError` a las 4 mutaciones de `useCotizacionPlantillas.ts` (guardar, aplicar, eliminar, actualizar). Cierra el fallo del guardrail `mutations-have-onerror` en CI y evita que los errores de RLS/red queden silenciosos.

## Verificación

- `tsgo` para validar tipos.
- El test `mutations-have-onerror.test.ts` lee el archivo y busca `onError` — no requiere ejecución adicional, pero se puede correr manualmente con `bunx vitest run src/__tests__/architecture/mutations-have-onerror.test.ts`.

## Fuera de alcance

- No se toca ningún consumidor de estas mutaciones: sus `onError` locales siguen funcionando; el `onError` en el hook actúa como red de seguridad global.
- No se agrega optimistic update ni rollback (fuera del alcance del guardrail).
