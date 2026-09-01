# Arreglo: "Otro usuario modificó este registro" al guardar el Paso 1 de una cotización nueva

## Qué pasó (confirmado)

Cinthia creó la cotización `COT-P-2026-0001` a las 20:07 y a las 20:15, al volver a guardar el Paso 1, la app la bloqueó diciendo que "otro usuario" la modificó. Nadie la modificó: el candado se disparó solo.

Analogía: al abrir el expediente anotamos la hora de la última firma para no pisar el trabajo de otro. En una cotización **nueva** el wizard anota "sin firma" (`null`), pero la base de datos sí firma la fila al crearla. Consulté la fila real: `created_at` y `updated_at` valen ambos `2026-09-01 20:07:23`, o sea el sello nunca es nulo. Al segundo guardado el wizard compara "sin firma" contra la firma real, no coincide y aborta con `LC_CONFLICTO_CONCURRENCIA`.

Esto afecta cualquier cotización recién creada en la misma sesión: volver al Paso 1, guardar el Paso 3 o finalizar puede fallar con el mismo mensaje.

## Qué se corrige (mínimo, sin features nuevas)

1. Al crear la cotización, el wizard guarda el sello real (`updated_at`) que devuelve la fila creada, en lugar de dejarlo en "sin firma". Así los guardados siguientes del mismo usuario pasan, y el candado sigue protegiendo contra ediciones de otra sesión.
2. Se elimina la rama de "sello nulo" del `UPDATE` de cotizaciones (`.is("updated_at", null)`), que en la práctica nunca puede coincidir y solo genera falsos conflictos.

No se toca la lógica de negocio del wizard, ni la validación de pasos, ni la base de datos.

## Detalles técnicos

- `src/features/cotizacion/hooks/wizard/useCotizacionUpdateGuard.ts`: el hook también envuelve `crearCotizacion` y, tras el insert, siembra `expectedRef` con el `updated_at` de la fila devuelta (`CotizacionRow` ya lo trae).
- `src/features/cotizacion/hooks/wizard/useCotizacionWizardForm.ts`: usa la versión envuelta de `crearCotizacion` en `mutationsGuardadas` (hoy solo envuelve `updateCotizacion`).
- `src/features/cotizacion/services/mutations/update.ts`: cuando `expectedUpdatedAt` es `null`/`undefined` se hace el `UPDATE` sin filtro de sello (comportamiento de "sin bloqueo optimista"); se retira la rama `.is("updated_at", null)` y su comentario B-8.
- Pruebas: actualizar `hooks/wizard/__tests__/useCotizacionUpdateGuard.test.ts` (nuevo caso: tras crear, el siguiente update viaja con el sello del insert) y `services/mutations/__tests__/update.test.ts` (sin sello ⇒ no se agrega filtro `updated_at`).
- Cierre: bump de `APP_VERSION` y entrada breve en `CHANGELOG.md`.
