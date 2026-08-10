# Ola 4 (Altas): verificación de los 17 hallazgos y batería de pruebas

## Estado verificado hoy (lecturas en base de datos y código)

Los 17 parches ya están vivos:

| ID | Verificación realizada | Resultado |
|----|------------------------|-----------|
| N1 | columna `factura_notas_credito.facturapi_claim_at` | existe |
| N2, N3 | `facturapi-webhook/helpers.ts` (dedupe post-éxito, mapeo `valid` → `Emitida`) | aplicado |
| N4, N5 | `facturapi-cancelar-*`, columna `pagos_factura.rep_cancellation_status` | aplicado |
| N6 | `crear_ajustes_factura_proveedor_rpc` valida `organization_id` del embarque | aplicado |
| N7 | `profit_por_cliente` con CTEs preagregadas | aplicado |
| N8 | `eerr_resumen_anual` devuelve `excluidos_sin_tc` | aplicado |
| N9 | `cartera_pendiente`: `dias_vencido` con signo (el `GREATEST(0,…)` sólo queda en el `ORDER BY`) | aplicado |
| N10 | `dashboard_summary`, `dashboard_details`, `operaciones_stats` excluyen `Borrador` | aplicado |
| N11 | `configuracion/services/index.ts` exige `organization_id` en el update por (categoría, clave) | aplicado |
| N12 | `aplicar_anticipo_a_factura` y `cancelar_anticipo_proveedor` validan la org del llamador | aplicado |
| N13 | alta de usuario fail-closed en `admin/services/usuario` | aplicado |
| N14 | `exchange-rates` con corte de día civil MX y TTL a medianoche local | aplicado |
| N15 | índices `uq_bbva_movimientos_pago_*` con `deleted_at IS NULL` + filtro en `sugerirCandidatos` + guard 409 en `conciliarConPago` | aplicado |
| N16 | índice `uq_facturas_proforma_moneda_viva` + traducción de 23505 a `LC_PROFORMA_YA_FACTURADA` | aplicado |
| N17 | `crear_embarque_borrador_desde_cotizacion` se llama sólo con `p_cotizacion_id` | aplicado |

Lo que falta es la red de seguridad: pruebas que fallen si alguno de estos arreglos se revierte.

## Pruebas a crear

### 1. SQL de invariantes — `supabase/tests/ola4_altas.sql` (nuevo)
Un solo archivo, con datos sembrados y `ROLLBACK` al final, que falle con mensaje explícito:
- N6/N12: llamar las tres RPC con un `embarque_id`/anticipo de otra organización y exigir excepción.
- N7: dos facturas + dos pagos para un mismo cliente y comprobar que `profit_por_cliente` no multiplica montos.
- N8: embarque con concepto en USD sin tipo de cambio → no suma y `excluidos_sin_tc = 1`.
- N9: factura no vencida → `dias_vencido` negativo.
- N10: embarque `Borrador` con ETD/ETA → no aparece en `totalActivos` ni en `conteoPorEstado.Confirmado`.
- N15/N16: verificar existencia de los tres índices únicos con predicado `deleted_at IS NULL` y probar que un movimiento en papelera ya no bloquea la reconciliación.

Se registra el archivo en la matriz del workflow de pruebas SQL para que corra en CI.

### 2. Pruebas de frontend (vitest)
- `configuracion/services/__tests__/index.test.ts`: caso nuevo — update por (categoría, clave) sin `orgId` lanza y con `orgId` filtra por organización (N11).
- `tesoreria/services/__tests__/sugerirCandidatos.test.ts`: un pago ligado a un movimiento vivo no se sugiere; ligado a uno en papelera sí (N15).
- `tesoreria/services/__tests__/conciliacion.test.ts`: conflicto 23505/409 se traduce a `LC_MOVIMIENTO_YA_VINCULADO` (N15).
- `proformas/services/__tests__/facturarCarrera.test.ts`: 23505 del índice nuevo → `LC_PROFORMA_YA_FACTURADA` y sin facturas huérfanas (N16).
- `admin/services/usuario/__tests__`: alta con email duplicado y con consulta que devuelve error → se rechaza (fail-closed, N13).
- `cotizacion/services/conversiones/__tests__`: la RPC se invoca sólo con `p_cotizacion_id` (N17).
- `dashboardEjecutivo/services/__tests__`: el agregador propaga `excluidos_sin_tc` sin romper (N8).

### 3. Pruebas de edge functions (Deno)
- `facturapi-emitir-nota-credito`: doble submit con claim tomado → segundo intento no timbra (N1).
- `facturapi-webhook/helpers_test.ts`: dedupe sólo tras éxito y `valid` → `Emitida` (N2, N3).
- `facturapi-cancelar-nota-credito` y `facturapi-cancelar-rep`: `substitution` con ObjectId y `cancellation_status` persistido (N4, N5).
- `exchange-rates/exchange_test.ts`: a las 19:00 CST devuelve el FIX de hoy MX y el TTL no cruza la medianoche local (N14).

### 4. Cierre
`CHANGELOG.md` + bump de `APP_VERSION`, y corrida completa de vitest más los archivos SQL nuevos.

## Notas técnicas
- Las pruebas SQL usan el patrón ya existente en `supabase/tests/*.sql` (bloques `DO` con `RAISE EXCEPTION 'TEST FAIL: …'`).
- Los mocks de Supabase siguen el patrón de cadena thenable ya usado en el proyecto; nada de `any`.
- Cada archivo nuevo se mantiene bajo 200 líneas (Power of 10); si un tema crece, se divide por hallazgo.
