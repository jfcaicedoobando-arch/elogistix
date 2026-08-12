# Cotización: montos en $0.00 al descargar el PDF

## Qué encontré (verificado en la base de datos)

En la cotización **COT-2026-0167** el PDF muestra `MXN 0.00` porque **así están guardados los datos**, no porque el PDF los pierda:

- `cotizaciones.conceptos_venta` tiene un solo renglón: "Servicios Profesionales de Logistica", cantidad 1, **precio unitario 0**, y `subtotal = 0`.
- En cambio, en `cotizacion_costos` sí hay dos renglones con precio de venta capturado: **MXN 82,000.00** y **USD 1,169.35** — pero ambos tienen el campo **concepto vacío** ("").

La causa: el paso 2 (Costos) permite guardar renglones con precio de venta pero **sin nombre de concepto**. La función que genera los conceptos de venta a partir de los costos (`buildConceptosFromCostos`) descarta silenciosamente todo renglón cuyo concepto esté vacío. Resultado: los importes capturados nunca llegan a `conceptos_venta`, y tanto el detalle como el PDF muestran ceros.

Analogía: el vendedor anotó los precios en un post-it sin escribir a qué servicio pertenecen; al pasar la cuenta en limpio, el sistema tira los post-it sin etiqueta y la cotización sale en cero.

## Qué voy a hacer

### 1. Impedir que se pierdan importes (raíz del bug)
- En el paso 2 del wizard: marcar en rojo y bloquear el avance cuando un renglón tenga **precio de venta o costo > 0 y el concepto vacío**, con mensaje claro: "Selecciona el concepto de este renglón; sin nombre no se genera el concepto de venta".
- En el guardado final: si algún renglón con venta > 0 quedó fuera de `conceptos_venta`, mostrar error y no dar por buena la cotización (hoy ese guard sólo actúa cuando la lista queda totalmente vacía).

### 2. Aviso y reparación desde el detalle de la cotización
- En el detalle: si hay costos con precio de venta pero `conceptos_venta` suma 0, mostrar un aviso accionable con botón **"Sincronizar conceptos de venta desde costos"** (usa los conceptos de los costos; si alguno está sin nombre, pide capturarlo primero).
- El botón de descargar PDF advierte antes de generar cuando la cotización está en 0, para no enviar documentos vacíos al cliente.

### 3. Corregir COT-2026-0167
Con el aviso anterior, el usuario podrá: capturar el nombre de cada concepto en la pestaña de costos, sincronizar y volver a descargar el PDF con MXN 82,000.00 y USD 1,169.35. No haré cambios directos en la base de datos salvo que lo pidas.

### 4. Detección de otras cotizaciones afectadas
Reviso si hay más cotizaciones con costos con venta > 0 y `conceptos_venta` en 0 y te entrego la lista para revisión (sin modificar nada automáticamente).

## Detalles técnicos

- Validación nueva en `FilaCostoLocalRow.tsx` / `TablaCostosLocal.tsx` y en `handlePaso2`/`handleGuardar` de `useCotizacionWizardSteps.ts`.
- `buildConceptosFromCostos` (en `domain/cotizacion.conceptos.ts`) sigue exigiendo concepto no vacío, pero ahora quien lo llama reporta cuántos renglones descartó en lugar de ignorarlos.
- Aviso + acción de sincronización en el detalle (`SeccionCostosInternosPLDetalle.tsx` y la sección de conceptos de venta), reutilizando `AvisoAccionable`.
- El PDF (`CotizacionDocument.tsx`) no cambia: ya renderiza fielmente lo guardado.
- Tests unitarios: renglón sin concepto bloquea el avance; sincronización desde costos genera importes correctos en USD y MXN.
- Actualizo `CHANGELOG.md` y subo `APP_VERSION`.
