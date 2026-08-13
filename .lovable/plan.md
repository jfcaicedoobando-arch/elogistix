# Desatorar la refacturación de la factura F1026

## Qué encontré (verificado en la base)

- **F1026** (`baf21261…`, INDIMEX TRADING, 95,120.00 MXN) está **timbrada y en estado "Pagada"**, con su pago del 12/08 y su REP `F4FC33D7…` **timbrado y vigente**. No tiene nada a medio camino.
- El único caso de refacturación que existe es de **F1027** (`2021b9e7…`), quedó en el paso 3 y ya está **cancelado** desde el 13/08 21:54. Ese caso no bloquea a F1026.
- La causa real: el menú sólo muestra "Refacturar a otro receptor" cuando la factura puede sustituirse, y esa condición exige estado exactamente **"Emitida"** (`facturaFlags.ts`: `timbradaVigente = !sinTimbrar && estado === 'Emitida'`). Al aplicar el pago, F1026 pasó a "Pagada" y la opción desapareció.
- La base **sí permite** abrir el caso: `abrir_caso_refacturacion` sólo rechaza Cancelada, Sustituida y Borrador. Es decir, es un candado de pantalla más estricto que la regla contable.

Analogía: la puerta está abierta, pero el letrero de la entrada se apagó porque la factura cambió de "Emitida" a "Pagada".

## Qué haré

1. Agregar un indicador propio para refacturación, `puedeRefacturarReceptor`, que se active cuando la factura esté **timbrada y viva** (Emitida, Pagada, Parcialmente pagada o Vencida), sin sustituta viva y con permiso de edición — el mismo criterio que ya usa la base.
2. Usar ese indicador (en lugar de "puede sustituir CFDI") para mostrar la opción "Refacturar a otro receptor" en el menú del detalle de factura. "Sustituir CFDI" se queda como está.
3. Pruebas unitarias del indicador para los estados Pagada, Parcialmente pagada, Vencida, Cancelada, Sustituida y Borrador.
4. Bump de `APP_VERSION` a **13.589.5** y entrada en `CHANGELOG.md`.

## Detalle técnico

- `src/features/facturacion/domain/facturaFlags.ts`: nuevo campo en `FacturaFlags` + `EMPTY_FLAGS`, calculado como `timbradaViva && canEdit && !isSustitutaViva(f)`, donde `timbradaViva = !sinTimbrar && !estaCancelada && estado !== 'Borrador'`.
- `src/features/facturacion/components/detalle/FacturaDetalleActionsBar.tsx`: mover el item `refacturar` fuera del bloque `if (flags.puedeSustituirCfdi)` y condicionarlo a `flags.puedeRefacturarReceptor && puedeRefacturar` (el permiso por rol se mantiene igual).
- Tests en `src/features/facturacion/domain/__tests__/facturaFlags*.test.ts` (archivo existente o nuevo, según el patrón actual).
- Sin cambios en base de datos ni en las RPC del asistente.

## Después de esto

Sobre F1026 podrás abrir el asistente y seguir los 5 pasos: cancelar el REP vigente, timbrar la nueva factura al receptor correcto, cancelar el CFDI original, reasignar el pago con el ordenante real y cerrar el caso.
