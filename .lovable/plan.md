## Objetivo

Cubrir con tests de Vitest los 6 módulos de lógica de negocio que están en 0%, usando `createSupabaseMock` para los servicios I/O y tests puros para el mapper. Bump `APP_VERSION` y `CHANGELOG.md`.

## Archivos a crear (todos `*.test.ts`)

1. **`src/features/crm/services/__tests__/automatizacionesEtapa.test.ts`** — ~14 casos
   - `fetchEtapa` / `fetchOportunidad` (data / null / error → null).
   - `notifyVendedorMovido`: no notifica si actor=vendedor o vendedor_id=null; sí notifica con título/link/mensaje correctos (mock de `crearNotificacionSilencioso`).
   - `crearTareaGanada`: noop si etapa ≠ ganada o sin responsableId; insert con asunto "Generar cotización en firme".
   - `cancelarActividadesPerdida`: noop si etapa ≠ perdida; update con `resultado: cancelada` y filtro `is(fecha_completada, null)`.
   - `crearTareaSeguimiento`: noop si etapa cerrada o flag off; insert con asunto "Seguimiento: …".
   - `runAutomatizaciones`: early return si falta etapa/op; ejecuta notify+seguimiento en etapa abierta.

2. **`src/features/embarques/services/__tests__/dashboardOperador.test.ts`** — ~9 casos (`vi.useFakeTimers`)
   - `fetchDocsFaltantesOperador`: [] sin embarques, cuenta pendientes y filtra 0, orden desc, propagación de error, filtros eq+in.
   - `fetchSinTrackingOperador`: `proximoArribo=true` con ETA en 1 día y último evento de hace 10 días; embarques sin eventos pasan (`diasSinUpdate=null`); embarques con tracking reciente se filtran; orden coloca `proximoArribo` primero.

3. **`src/features/cotizacion/services/__tests__/wizard.test.ts`** — ~10 casos (mock de `@/services/storage` y `@/lib/supabase/cast`)
   - `savePaso1`: crea vs actualiza según `cotizacionId`; sube MSDS sólo si `tipoCarga="Mercancía Peligrosa"` y hay archivo; ruta `cotizaciones/msds-*.pdf`.
   - `savePaso2`: noop con lista vacía; calcula `costo_total = cantidad × costo_unitario`; normaliza `notas` undefined → "".
   - `savePaso3`: update con `subtotal=totalUSD` y `conceptos_venta`.
   - `savePasoFinal`: modo create cambia estado a "Borrador" y registra "crear"; modo edit no toca estado y registra "editar".

4. **`src/features/crm/services/__tests__/cotizacionDesdeOportunidad.test.ts`** — ~6 casos
   - `insertCotizacionDesdeOportunidad`: payload con folio/modo/tipo "Importación"/cliente_id/oportunidad_id; `es_prospecto=true` cuando cliente_id null; nulls → "" para origen/destino/cliente_nombre; propagación de error.
   - `actualizarEtapaOportunidad`: update `{etapa_id, probabilidad}` filtrado por id; propagación de error.

5. **`src/lib/mappers/__tests__/cotizacion.test.ts`** — ~13 casos (puro, sin mocks)
   - `buildPaso1Data` cliente: catálogo vs prospecto.
   - Peso/volumen/piezas por modo: Marítimo LCL suma, FCL ceros, Aéreo suma peso volumétrico, Terrestre toma valores manuales.
   - Mercancía/ruta: Terrestre forza `incoterm="N/A"` y `tipo_movimiento=""`; FCL setea `tipo_contenedor`; LCL forza `tipo_contenedor=null`; `seguro=false` fuerza `valor_seguro_usd=0`.
   - Vigencia: default 15 días, mínimo 1, `validez_propuesta` serializado a `YYYY-MM-DD`; meta moneda USD, subtotal 0, operador.

6. **`src/features/facturas/services/__tests__/exports.test.ts`** — ~9 casos
   - `fetchLayoutContableData`: estructura vacía sin ids (sin BD); facturas+clientes arma map RFC; clientes con `rfc=null` se omiten; no consulta clientes si todas las facturas tienen `cliente_id=null`; propagación de error de facturas y de clientes.
   - `fetchEstadoCuentaFacturas`: filtros eq + in + order asc; [] sin data; propagación de error.

## Cambios de metadata

- `src/constants/appVersion.ts`: `12.98.8` → `12.98.9`.
- `CHANGELOG.md`: agregar entrada `## [12.98.9] - 2026-06-13` listando los 6 archivos y el conteo total de casos (~61 tests).

## Verificación

Ejecutar `bunx vitest run` sobre los 6 archivos nuevos en una sola pasada y confirmar 100% verdes antes de cerrar. Si algún test falla por shapes de Supabase autogenerados (tipos enum, `as never`), ajustar con casts mínimos al tipo correcto.

## Fuera de alcance

- Hooks RHF (`useNuevoEmbarqueWizard`, `useEmbarquesPageState`) — alto costo de mock, mejor cubrir vía e2e.
- Cambios en código de producción: estos tests sólo leen comportamiento actual, no proponen refactors.
