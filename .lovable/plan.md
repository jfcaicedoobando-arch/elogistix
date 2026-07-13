## Problema

`buildPaso1Data → partesRuta` llama `v.validezPropuesta.toISOString()`, pero `validezPropuesta` en tiempo de ejecución es un **string**, no un `Date`. El tipo dice `Date | undefined`, así que TS no lo detecta.

## Causa raíz

El draft del wizard se persiste en `localStorage` vía `useCotizacionDraftAutosave` (`JSON.stringify(values)`). Al pasar por JSON, `Date` → string ISO. Al recargar la página, `loadDraft` devuelve el objeto tal cual y `form.reset(draft.values)` mete un string en `validezPropuesta`. Al guardar el Paso 1, el mapper explota.

Analogía: guardaste la fecha en una postal (JSON) y al llegar sólo tienes el texto de la fecha impreso; ya no es un reloj con manecillas (`Date`) al que puedas pedirle "dame tu ISO".

## Fix propuesto

Dos capas — defensa y origen — para que no vuelva a pasar:

1. **`domain/mappers/cotizacion.ts` — defensivo en el boundary**
   Normalizar `validezPropuesta` con un helper local `toDate(x)`:
   - `Date` válida → misma
   - `string` → `new Date(string)` (si NaN → null)
   - otro → null
   Reemplazar la línea 88 para usar el helper y evitar el crash.

2. **`hooks/wizard/useCotizacionDraftAutosave.ts` — revivir Date al cargar**
   En `loadDraft`, después de validar el shape, revivir campos `Date` conocidos del draft (`values.validezPropuesta`, y por precaución `values.tarifaHasta` si existiera en el estado). Función `reviveDates(values)` que convierte strings ISO en `Date`.

## Archivos a modificar

- `src/features/cotizacion/domain/mappers/cotizacion.ts` — helper `toDate` + usarlo en línea 88.
- `src/features/cotizacion/hooks/wizard/useCotizacionDraftAutosave.ts` — revivir `validezPropuesta` (y otros campos Date del form) al cargar.
- `src/features/cotizacion/domain/mappers/__tests__/cotizacion.test.ts` — un test que pase un string ISO en `validezPropuesta` y verifique que `buildPaso1Data` no truena y produce el `validez_propuesta` correcto.
- `CHANGELOG.md` + `APP_VERSION` → `13.299.6`.

## Verificación

- `bunx vitest run src/features/cotizacion/domain/mappers/__tests__/cotizacion.test.ts`
- Recargar `/cotizaciones/nueva` con un draft persistido y avanzar Paso 1.