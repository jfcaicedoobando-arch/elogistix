# Embarque 323: por qué parece Confirmado cuando en realidad es Borrador

## Qué encontré (verificado en la base de datos)

El expediente **ELIMP00323** (cliente ROLLOS Y ETIQUETAS ROLLET) está en la base de datos con:

- `estado = 'Borrador'`
- `etd = 2026-07-27`, `eta = 2026-08-04`, `fecha_llegada_real` vacía
- Sí tiene cotización origen y BL master (HPH600353200)

Es decir: **el embarque nunca se confirmó**. Sigue siendo borrador.

## Por qué se ve como si estuviera confirmado

La línea de tiempo de fases (la barrita "Propuesta → Confirmado → En Tránsito → …" del tab Resumen y del tab Tracking) tiene dos reglas que hoy mienten cuando el embarque es borrador:

1. La fase **Confirmado** está marcada como completada **siempre**, sin mirar el estado real.
2. La fase **En Tránsito** se marca completada si el **ETD ya pasó**, aunque el embarque siga en borrador. Como el ETD fue el 27/07, aparece "ya zarpó".

Analogía: es como una lista de pendientes donde los primeros dos renglones vienen tachados de fábrica. El expediente todavía está en el escritorio sin firmar, pero la lista dice "firmado y enviado".

El badge del encabezado sí dice "Borrador" y hay una alerta amarilla de borrador, pero la línea de tiempo pesa más visualmente y gana la lectura.

## Qué voy a corregir

1. **Fase Confirmado honesta**: se marca completada sólo si el estado guardado ya salió de `Borrador` (o si el embarque ya está en cualquier fase posterior). En borrador queda como fase *actual/pendiente*.
2. **Fase En Tránsito**: no se puede completar por fecha (ETD pasado) mientras el estado sea `Borrador`. La promoción por fechas sigue funcionando igual para embarques ya confirmados.
3. **Fase inicial visible**: cuando el estado es `Borrador`, la línea de tiempo lo indica explícitamente (fase actual = Borrador/Confirmado pendiente) para que el usuario vea de un golpe que falta confirmar.
4. **Refuerzo del aviso**: en la alerta amarilla de "Embarque en borrador" agrego, cuando el ETD ya pasó, la nota de que las fechas ya vencieron y el embarque sigue sin confirmar, con el botón/indicación para avanzar a Confirmado.
5. **Consistencia de badges**: `Borrador` se agrega al catálogo de estados del dominio `embarque` en el registry de estados, para que su badge y sus filtros no dependan del mapeo de facturación.

No cambio el dato del embarque 323: seguirá en Borrador hasta que un operador lo confirme (para confirmarlo el sistema pide peso > 0, contenedor, naviera y BL, según las reglas actuales).

## Detalle técnico

- `src/features/embarques/domain/embarqueFases.ts`: `calcularFasesEmbarque` — fase `confirmado` deja de ser `"completada"` fija; `transitoCompletada` deja de considerar `etd <= hoy` cuando `embarque.estado === "Borrador"`; `faseIdParaEstado` devuelve la fase inicial para `Borrador`.
- Tests nuevos/ajustados en `src/features/embarques/domain/__tests__/embarqueFases*.test.ts` cubriendo: borrador con ETD pasado, confirmado con ETD pasado, y estados posteriores.
- `src/features/embarques/components/EmbarqueDetalleTabs.tsx`: texto de la alerta de borrador con la variante "fechas vencidas".
- `src/lib/status/statusRegistry.ts`: agregar `"Borrador"` a `DOMAIN_STATUSES.embarque`.
- Actualizar `CHANGELOG.md` y `APP_VERSION`.
