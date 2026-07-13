# Bug: conceptos del paso 2 no llegan al paso 3 en cotización LCL

## Qué está pasando (analogía)

El wizard tiene **dos libretas separadas**:

- **Libreta A (paso 2)** — "Costos internos y P&L": aquí vives cuando armas costos por proveedor (flete marítimo, cargos en destino, flete terrestre, etc.).
- **Libreta B (paso 3)** — "Conceptos para el cliente": lo que verá el cliente en la cotización.

Cuando pasas del paso 2 al 3, el sistema hace **una única fotocopia** de la libreta A a la B. Si la fotocopia se toma en el mal momento (o ya se tomó una vez y editas después), la libreta B queda vacía o desactualizada.

## Evidencia en `COT-2026-0123` (LCL)

Confirmado en BD:

| Campo | Valor |
|---|---|
| `tipo_embarque` | `LCL` |
| `tipo_contenedor` | `null` |
| `tarifa_id` | apunta a una tarifa **20DRY (FCL)** |
| `cotizacion_costos` (paso 2) | 3 filas: Flete Marítimo, Cargos en Destino, Flete Terrestre |
| `cotizaciones.conceptos_venta` (paso 3) | `[]` vacío |
| `tarifa_override` | `{}` vacío |

Es decir: el paso 2 sí guardó, pero el paso 3 se quedó sin conceptos. Los pasos 2 y 3 son **dos arrays de React separados** que solo se sincronizan una vez en `handlePaso2` (`useCotizacionWizardSteps.ts:73-94`), y esa sincronización está protegida por un flag `costosPreLlenados` que, una vez `true`, ya no se vuelve a activar.

## Causas raíz (dos, se refuerzan en LCL)

1. **Guard de una sola pasada**: `handlePaso2` solo sincroniza `costosInternos → conceptosUSD/MXN` si `!costosPreLlenados && costosInternos.length > 0`. Después nunca refresca, aunque cambies los costos.
2. **Race con la precarga por tarifa en LCL**: `SeccionCostosInternosPLLocal` precarga los costos con `buildCostosDesdeTarifa`, pero ese builder está pensado para contenedor (`unidad_medida="contenedor"`, usa `tipo_contenedor_nombre`) — en LCL genera filas inconsistentes o vacías. Si el usuario le da "Siguiente" antes de que la precarga termine (o edita a mano y vuelve atrás), `costosInternos` puede estar vacío en el momento del salto → nada se copia, y como el flag solo se marca cuando SÍ hubo copia, el estado queda en un limbo donde la copia nunca se retomará en pasadas siguientes al paso 2.

## Fix propuesto

### 1. Refactor de la sincronización paso 2 → paso 3 (`useCotizacionWizardSteps.ts`)

- Eliminar el guard `costosPreLlenados` como bandera de "una sola vez". Cambiarlo por una sincronización **derivada e idempotente**: cada vez que se avanza al paso 3, reconstruir `conceptosUSD/MXN` desde `costosInternos` con `buildConceptosFromCostos`, respetando ediciones manuales del usuario en el paso 3.
- Estrategia recomendada (mínimo intrusiva):
  - Mantener `costosPreLlenados`, pero **también** re-sincronizar si `costosInternos` cambió respecto al último snapshot (guardar un hash/`JSON.stringify` firmado del último input procesado).
  - Si el usuario ya editó manualmente en paso 3 (detectable por un flag `conceptosEditadosManualmente`), advertir con un `AlertDialog` en español antes de sobreescribir ("Los costos del paso 2 cambiaron. ¿Regenerar los conceptos del paso 3? Se perderán tus ediciones manuales").

### 2. Adaptar `buildCostosDesdeTarifa` para LCL (`seccionRuta/buildCostosDesdeTarifa.ts`)

- Detectar cuando la tarifa/cotización es LCL (`tipo_embarque === 'LCL'`) y:
  - Cambiar `unidad_medida` a `"m³"` (o `"W/M"` si aplica).
  - No inyectar el nombre del contenedor en el concepto (o etiquetarlo como "Flete LCL").
  - Usar `dias_libres_almacenaje_lcl` de la tarifa donde hoy usa `dias_libres_demoras`.
- Blindaje: si la tarifa vinculada no es compatible con LCL (ej. `tipo_contenedor_id` presente en tarifa pero cotización es LCL), mostrar un `Alert` amarillo en el paso 1/2: "La tarifa seleccionada es para contenedor; revisa las unidades antes de continuar."

### 3. Validación al salir del paso 2

- Antes de permitir `nextStep()` en paso 2, validar que `costosInternos.length > 0`. Si no, mostrar un toast en español: "Agrega al menos un costo interno antes de continuar."
- Esto elimina el race donde el usuario avanza antes de que se llenen los costos.

### 4. Migración de datos existentes (opcional, solo `COT-2026-0123`)

- Recuperar la cotización afectada: regenerar `cotizaciones.conceptos_venta` desde `cotizacion_costos` vía `buildConceptosFromCostos` en un script SQL/RPC de una sola vez.
- Confirmar con el usuario antes de correr.

### 5. Test de regresión

- Nuevo test en `src/features/cotizacion/hooks/__tests__/useCotizacionWizardSteps.test.tsx`:
  - **Caso A**: paso 2 con 3 costos → paso 3 → volver a paso 2 → editar un costo → paso 3 → `conceptosUSD` refleja el cambio.
  - **Caso B (LCL)**: cotización LCL con tarifa, `costosInternos` inicialmente vacío por race → click "Siguiente" muestra toast de validación y no avanza.
  - **Caso C**: `buildCostosDesdeTarifa` con `tipoEmbarque='LCL'` devuelve filas con `unidad_medida='m³'`.

## Verificación final

- `bun run test src/features/cotizacion` verde.
- Playwright E2E: crear cotización LCL, capturar costos, avanzar a paso 3, confirmar que los conceptos aparecen. Volver atrás, editar, avanzar de nuevo, confirmar propagación.
- Bump `APP_VERSION` a `13.291.0` + entrada en `CHANGELOG.md`.

## Fuera de alcance

- Rediseño amplio de la relación `cotizacion_costos` ↔ `cotizaciones.conceptos_venta` (fusionar tablas). Se documenta como deuda técnica para plan futuro.
- Soporte de tarifas LCL nativas en tabla `costeo_tarifas` (hoy la tabla está modelada para contenedor). Solo se blinda la asimetría; el modelo completo se aborda aparte.

## Detalles técnicos (para el equipo)

| Archivo | Cambio |
|---|---|
| `src/features/cotizacion/hooks/wizard/useCotizacionWizardSteps.ts:73-94` | Reemplazar guard booleano por hash de `costosInternos`; agregar `conceptosEditadosManualmente` |
| `src/features/cotizacion/domain/cotizacion.ts` (`buildConceptosFromCostos`) | Aceptar hint `tipoEmbarque` para unidad de medida en LCL |
| `src/features/cotizacion/components/SeccionCostosInternosPLLocal.tsx:36-51` | Bloquear precarga por tarifa incompatible; toast informativo |
| `src/features/cotizacion/components/seccionRuta/buildCostosDesdeTarifa.ts:34-82` | Rama LCL (unidad, sin `tipo_contenedor_nombre`, `dias_libres_almacenaje_lcl`) |
| `src/features/cotizacion/hooks/wizard/*` | Validación `costosInternos.length > 0` en `nextStep` desde paso 2 |
| Tests nuevos | Regresión paso 2 → 3 (edición, LCL, race) |
