
Diagnóstico

Sí hay una inconsistencia de lógica entre la lista y el detalle:

1. En el listado de embarques sí se calcula el estado “real” con fechas
- `src/pages/Embarques.tsx`
- usa `calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado)`
- por eso ELIMP00141 aparece como `En Tránsito`

2. En el detalle se muestra primero el estado guardado en la base
- `src/pages/EmbarqueDetalle.tsx`
- el badge del header usa `embarque.estado` directo
- `src/components/embarque/TabResumen.tsx`
- la línea de tiempo también usa `embarque.estado` directo

3. El detalle intenta corregirlo después, en segundo plano
- `src/pages/EmbarqueDetalle.tsx`
- hay un `useEffect` que vuelve a calcular el estado y llama `useSyncEstadoEmbarque()`
- o sea: entras al detalle, primero ves el estado viejo (`Confirmado`) y luego intenta sincronizarlo

Por qué pasa con ELIMP00141

Con la regla actual:
- solo aplica para `Marítimo` + `Importación`
- si hoy ya pasó el `ETD`
- y todavía no llega el `ETA`
- entonces `calcularEstadoEmbarque(...)` devuelve `En Tránsito`

Eso significa que ELIMP00141 probablemente tiene:
- `estado` guardado en BD = `Confirmado`
- pero por sus fechas ya debería verse como `En Tránsito`

Plan de corrección

1. Unificar el estado visual del detalle
- En `src/pages/EmbarqueDetalle.tsx`, calcular una sola variable:
  - `estadoVisual = calcularEstadoEmbarque(...)`
- usar `estadoVisual` para:
  - badge principal
  - lógica de “Avanzar a …” cuando aplique

2. Unificar la línea de tiempo del resumen
- En `src/components/embarque/TabResumen.tsx`
- usar el mismo `estadoVisual` para `currentStepIndex`
- así la timeline y el badge siempre coinciden con la lista

3. Mantener la sincronización en background, pero solo como persistencia
- dejar `useSyncEstadoEmbarque()` para que la BD se actualice
- pero la UI no debe depender de esperar ese update para verse correcta

4. Validar el flujo
- verificar que ELIMP00141 se vea `En Tránsito` tanto en:
  - listado
  - detalle
  - timeline
- revisar que estados manuales sigan respetándose:
  - `Arribo`, `En Aduana`, `Entregado`, `EIR`, `Cerrado`

Archivos a ajustar
- `src/pages/EmbarqueDetalle.tsx`
- `src/components/embarque/TabResumen.tsx`
- `src/pages/Changelog.tsx`

Detalle técnico clave

```text
Lista:
estado mostrado = calcularEstadoEmbarque(...)

Detalle hoy:
estado mostrado = embarque.estado
y luego intenta sync a BD en background

Corrección:
estado mostrado en detalle = calcularEstadoEmbarque(...)
sync a BD queda solo como persistencia, no como fuente visual
```
