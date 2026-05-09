## Problema

El embarque tiene contenedor `BEAU6309761` con naviera `EGLV` (Evergreen). La API de JSONCargo **sí encuentra** ese contenedor bajo EVERGREEN (probado: HTTP 200 con datos de SHANGHAI 119E, ETA 13/05/2026).

Sin embargo el validador local `validatePrefixMatchesNaviera` bloquea la llamada antes de salir a la API porque en `src/lib/jsoncargo/containerPrefixes.ts` el prefix `BEAU` está mapeado solo a `["MAERSK", "MSC"]`. En realidad BEAU = Beacon Intermodal, un pool de leasing que se asigna a prácticamente todas las navieras grandes (Maersk, MSC, **Evergreen**, ONE, CMA CGM, Hapag-Lloyd…).

El catálogo local fue diseñado para "ahorrar cuota" pero está produciendo **falsos negativos** que impiden trackear contenedores reales y válidos.

## Solución (scope mínimo)

Ampliar las entradas de prefixes de **leasing pools** (no propietarios de naviera) para incluir todas las navieras soportadas por JSONCargo. Estos pools no deberían bloquear nunca por mismatch.

### Cambios en `src/lib/jsoncargo/containerPrefixes.ts`

Actualizar las entradas de leasing a algo cercano a "any-major":

```text
BEAU: [MAERSK, MSC, EVERGREEN, ONE, CMA_CGM, HAPAG_LLOYD]
BMOU: [MSC, MAERSK, EVERGREEN, ONE, CMA_CGM, HAPAG_LLOYD]
TEMU: [EVERGREEN, MSC, ONE, MAERSK, CMA_CGM, HAPAG_LLOYD]
TCLU: [MSC, MAERSK, EVERGREEN, ONE, CMA_CGM, HAPAG_LLOYD]
TCNU: [MSC, MAERSK, EVERGREEN, ONE, CMA_CGM, HAPAG_LLOYD]
TGBU: [HAPAG_LLOYD, ONE, MAERSK, MSC, EVERGREEN, CMA_CGM]
GLDU: [MAERSK, EVERGREEN, MSC, ONE, CMA_CGM, HAPAG_LLOYD]
GESU: [MAERSK, MSC, EVERGREEN, ONE, CMA_CGM, HAPAG_LLOYD]
TRHU: [EVERGREEN, MAERSK, MSC, ONE, CMA_CGM, HAPAG_LLOYD]
TRIU: [EVERGREEN, MAERSK, MSC, ONE, CMA_CGM, HAPAG_LLOYD]
SEGU: [MAERSK, MSC, EVERGREEN, ONE, CMA_CGM, HAPAG_LLOYD]
TGCU: [EVERGREEN, MAERSK, MSC, ONE, CMA_CGM, HAPAG_LLOYD]
UESU: [EVERGREEN, MAERSK, MSC, ONE, CMA_CGM, HAPAG_LLOYD]
```

Los prefixes propietarios (MAEU, MSCU, HLXU, COSU, EGHU, ZIMU, YMLU, ONEU, HMMU, PCIU, OOLU, OOCU, etc.) **no se tocan** — esos sí deben validar estrictamente.

### Mismo cambio en `supabase/functions/_shared/jsoncargo.ts`

`PREFIX_TO_CARRIERS` (constante espejo en el edge function) recibe la misma actualización para mantener consistencia del lado servidor (cron `jsoncargo-track-batch` y validación dentro de `jsoncargo-track`).

### Changelog

Nueva entrada `8.132.5` (patch) en `src/content/changelog/v8/chunks/0.ts`, `src/content/changelogData.ts` y bump de `src/constants/appVersion.ts`.

## Verificación

1. Recargar `/embarques/4e8b16c5-…?tab=tracking` y hacer click en **Sincronizar tracking** → ya no debe aparecer el toast de "Prefix BEAU no coincide con EGLV"; debe llegar a la API y traer datos (SHANGHAI, ETA 13/05/2026).
2. Sigue bloqueando casos reales inválidos (ej. `MAEU1234567` con naviera `EGLV` → MAEU es propietario Maersk, no toca).

## Alternativa descartada

Convertir el validador en *warning* y nunca bloquear (deferir a la API). Es la solución "correcta" a largo plazo, pero cambia comportamiento en más superficies (UI del wizard de embarques, mensajes, e-mails) y excede el scope del fix puntual reportado.
