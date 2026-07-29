## Estado

El plan C1–C6 del documento ya está aplicado y verificado (versión actual 13.324.1). Lo que sigue son dos residuos detectados al revisar, más un paso de higiene que el propio documento pedía.

## Residuo 1 — `src/lib/financial/costosUSD.ts`

Sigue llamando a `convertirAMXN` y `convertirAUSD` (ya marcadas como deprecadas). Esas funciones tienen `tipoCambioUSD = 1` por omisión, así que un costo en dólares sin tipo de cambio se suma como si fuera pesos.

Cambio: usar `aMxn` y `factorEntreMonedas`; cuando no haya tipo de cambio confiable, excluir el monto y exponer un contador de "montos sin TC" en el resultado, igual que hace `sumarEnMxn`.

## Residuo 2 — `src/features/embarques/domain/embarqueKpis.ts`

Misma situación en el KPI de costos del embarque: `convertirAMXN(monto, moneda, tcUsd, tcEur)`. Se migra al canon y el KPI deja de contar montos no convertibles en lugar de inflarlos.

## Higiene

- Regenerar `src/integrations/supabase/types.ts` tras las migraciones de C4/C5, como pedía el documento, para no agregar casts manuales.
- Tests: extender `costosUSD.test.ts` y `embarqueKpis` con casos "sin TC → excluido, contador en 1".
- Bump de `APP_VERSION` a 13.324.2 y entrada en `CHANGELOG.md`.

## Detalle técnico

Tras esta ola, `convertirAMXN` y `convertirAUSD` quedan sin llamadores en producción y se pueden eliminar (o dejar sólo para tests legacy). Ninguna migración SQL nueva es necesaria.
