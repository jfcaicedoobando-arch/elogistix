## Problema

En v13.299.1 quitamos el panel "Tarifa marítima vinculada" para LCL y agregamos flete manual, pero el validador del Paso 1 (`validateMaritimo` en `handlePaso1Crm.ts`) sigue exigiendo `tarifaId` para todo modo Marítimo. Por eso el wizard bloquea con:

> "Vincula o crea una tarifa marítima antes de continuar (Paso 1 → Tarifa marítima vinculada)."

## Cambio propuesto

Un único archivo: `src/features/cotizacion/hooks/wizard/handlePaso1Crm.ts`

En `validateMaritimo(v)`:
- Si `v.tipoEmbarque === "LCL"`, no exigir tarifa vinculada. En su lugar, validar que el flete manual esté capturado:
  - `v.lclFleteManual.tarifaWM > 0`
  - `v.lclFleteManual.consolidadorProveedorId` no vacío
- Si falta algo, devolver mensaje claro: *"Captura el flete LCL (Tarifa W/M y Consolidador) antes de continuar."*
- Si está completo, devolver `null` (permite avanzar).
- FCL sigue igual: requiere `tarifaId` salvo Incoterm sin flete de venta.

También bump `APP_VERSION` a `13.299.4` y una línea en `CHANGELOG.md`.

## Analogía

Antes el guardia de la puerta pedía "boleto de tarifa" a todos los marítimos. Ahora los LCL entran con "recibo de flete manual" (W/M + consolidador); los FCL siguen mostrando su boleto de tarifa.

## Fuera de alcance

No se toca UI ni otros pasos; sólo la regla de validación del Paso 1.