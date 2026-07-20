## Objetivo

Después de arreglar `Borrador → En Tránsito` (v13.302.9) y `ESTADOS_EMBARQUE` desincronizado (v13.302.10), auditar el resto de la app en busca de casos con la **misma clase de bug**: constantes UI que no reflejan la máquina de estados de BD, o mutaciones que fuerzan estados sin respetar el grafo `transicion_embarque_valida`.

## Hallazgos confirmados

### 🔴 Bug real 1 — `En Proceso` existe en BD pero está fuera de la UI de embarques

El enum `estado_embarque` incluye `"En Proceso"` (usado por Operaciones dashboard y por aristas `En Tránsito → En Proceso → {En Tránsito, En Aduana, Llegada, Arribo}` en el grafo). Pero:

- `src/features/embarques/constants/embarqueConstants.ts` — ni `ESTADOS_EMBARQUE` ni `ESTADOS_ACTIVOS` lo incluyen.
- `src/features/dashboard/domain/parsers/dashboardTypes.ts` — `EMPTY_CONTEO` (basado en `ESTADOS_ACTIVOS`) no lo cuenta.
- `getSiguienteEstado("En Proceso")` retorna `null` → el botón "Avanzar estado" **desaparece** y el operador queda atorado sin forma de avanzar por UI.
- Los filtros `filterEstado` del listado y `calcularEstadoEmbarque` allowlist tampoco lo consideran.

**Consecuencia:** cualquier embarque que llegue a `En Proceso` (vía RPC directa, migración legacy o soporte) queda invisible en filtros del dashboard principal y sin acción para salir.

### 🔴 Bug real 2 — `actualizarFechaLlegadaRealEmbarque` fuerza estado "Llegada" sin chequear el actual

`src/features/embarques/services/embarqueDirectMutations.ts:29-42` hace `UPDATE embarques SET fecha_llegada_real=…, estado='Llegada'` sin importar el estado previo. El grafo sólo permite entrar a `Llegada` desde `En Tránsito`, `En Aduana` o `En Proceso`. Capturar fecha de llegada real cuando el embarque está en `Confirmado`, `Arribo`, `Entregado`, `EIR`, `Cerrado`, `Borrador` o `Cotización` disparará `LC_TRANSICION_INVALIDA` — mismo síntoma que el requestId `05e6a0ab` que ya arreglamos.

El caso más probable en producción: usuario captura fecha real **después** de que auto-sync (o avance manual) ya pasó a `Arribo`/`Entregado`. Hoy no lo tenemos silenciado en Sentry porque no todos los flujos llegan a este punto, pero la fragilidad está.

### 🟡 Bug latente 3 — `useSyncEstadoEmbarque` no clasifica `LC_TRANSICION_INVALIDA`

`src/features/embarques/hooks/mutations/useEstadoEmbarque.ts:73-97` usa `actualizarEstadoEmbarque` (raw `.update`) y no traduce el error a un toast humano. Hoy el allowlist de `calcularEstadoEmbarque` (v13.302.9) evita que llegue basura, pero cualquier caller nuevo bypasearía la protección. La UI sólo debe permitir avances válidos.

### 🟢 Verificado sin regresión

- `ESTADOS_COTIZACION` (7 valores) coincide con el enum `estado_cotizacion`. UI y BD alineadas.
- `FACTURA_ESTADOS_VIVOS` filtra reportes correctamente (Fase v13.301.62).
- `estado_proforma` (3 valores) y flujo `actualizar_estado_cliente_proforma` bien.
- Grafo `transicion_garantia_valida` ya usa RPC `set_garantia_estado` con manejo de errores dedicado (`garantiasErrors.ts`), no hay update directo desde UI.

## Fix

### 1. Añadir `"En Proceso"` a las constantes UI de embarques

- `src/features/embarques/constants/embarqueConstants.ts`
  - Añadir `"En Proceso"` a `ESTADOS_EMBARQUE` (posición: entre `En Tránsito` y `En Aduana`, coherente con desempeñoChart).
  - Añadir a `ESTADOS_ACTIVOS`.
- `src/features/dashboard/domain/parsers/dashboardTypes.ts`
  - Añadir clave `"En Proceso": 0` a `EMPTY_CONTEO`.
- `src/features/dashboard/domain/parsers/dashboard.ts`
  - Incluir mapeo en `parseConteoPorEstado`.
- Actualizar guardrail `estados-embarque-sync.test.ts` — el "happy path" es lineal, pero el nuevo `ESTADOS_EMBARQUE` puede seguir cumpliéndolo insertando `En Proceso` entre `En Tránsito` y `En Aduana` (la arista `En Tránsito → En Proceso → En Aduana` existe en el grafo BD).

### 2. Hacer `actualizarFechaLlegadaRealEmbarque` idempotente respecto al estado

`src/features/embarques/services/embarqueDirectMutations.ts:29-42`:

- Sólo tocar `estado` cuando el actual está en `{En Tránsito, En Aduana, En Proceso}`. En cualquier otro caso, actualizar únicamente `fecha_llegada_real` (respetando estados ya avanzados como `Arribo`/`Entregado`/`EIR`/`Cerrado` y bloqueando previos comerciales).
- Implementación mínima: leer estado actual, decidir el payload, o mejor: usar RPC `avanzar_estado_embarque` cuando aplique y `.update({fecha_llegada_real})` puro en el resto.

### 3. Clasificar `LC_TRANSICION_INVALIDA` en `useSyncEstadoEmbarque`

`src/features/embarques/hooks/mutations/useEstadoEmbarque.ts:73-97`:

- Añadir `errorTitle` y catcher que, si `message.includes("LC_TRANSICION_INVALIDA")`, muestre toast humano ("El estado del embarque cambió; recarga para ver el nuevo").
- Igual que hace `useEmbarqueEstadoActions.ts:108-115` con `fecha_llegada_real_requerida`.

### 4. Tests

- `embarqueDirectMutations.test.ts`: caso "fecha llegada real sobre embarque en Arribo NO fuerza a Llegada".
- `useEmbarqueEstadoActions.helpers.test.ts`: extender `getSiguienteEstado("En Proceso")` retorna un siguiente válido (probablemente `En Aduana`, siguiendo el orden lineal).
- `estados-embarque-sync.test.ts`: actualizar `HAPPY_PATH_BD` para incluir `En Proceso`.

### 5. Housekeeping

- Bump `APP_VERSION` → `13.302.11`.
- Entrada en `CHANGELOG.md` referenciando esta auditoría post requestId `c80465e4` y explicando los tres fixes.

## Fuera de alcance

- **Aristas de retroceso** (`Confirmado → Cotización`, `En Aduana → En Tránsito`, `Arribo → Llegada`, etc.): existen en el grafo pero no hay UI para invocarlas. No es un bug: es una capacidad no expuesta. Si se quiere, se propone como feature separada.
- **Grafo de `garantías`**: revisado, no requiere cambios.
- **Cotización/Factura/Proforma/NC**: enums alineados con UI.
- **Migraciones nuevas de BD**: no se toca el grafo ni la máquina de estados.

## Detalles técnicos

- Ubicación canónica del grafo BD: `supabase/migrations/20260718214722_*.sql` líneas 24-35.
- Aristas relevantes agregadas al considerar `En Proceso`:
  ```text
  En Tránsito ─┬─→ En Aduana
               ├─→ En Proceso ──→ {En Tránsito, En Aduana, Llegada, Arribo}
               └─→ Llegada
  ```
- El `getSiguienteEstado` actual es un `indexOf + 1` sobre `ESTADOS_EMBARQUE`; funcionará automáticamente al insertar `En Proceso` en la posición correcta.
