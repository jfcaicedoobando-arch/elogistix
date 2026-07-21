
# Fase 4 · Auditoría v3 — Sprint 1 restante

## Estado del documento subido

El doc v3 trae 78 fixes en 4 sprints. Muchos ya se cerraron en fases previas (v13.303.12–v13.303.45):

**Ya remediados (no re-abrir):**
- FIX-01, 06 (credenciales y `.env`) → Sprint 0 v13.303.12
- FIX-02, 16 (validar_cierre_embarque + moneda CxP) → Fase M
- FIX-03 (proforma facturada + índice único) → Fase G
- FIX-04 (claim atómico timbrado) → Fase K
- FIX-05 (folio cotización atómico + `siguiente_folio`) → migración previa
- FIX-07, 21 (RPC transaccional cotización→embarque + guards) → Fase v13.303.16
- FIX-08, 23 (sobrepago con NC + FOR UPDATE) → **v13.303.43**
- FIX-09 (PNL excluye Sustituida) → Fase P
- FIX-10 (fallback Banxico bloqueado) → **v13.303.44**
- FIX-11 (helper `tcValido` propagado) → **v13.303.44 + v13.303.45**
- FIX-13 (comisiones convertir_a_mxn) → **v13.303.45**
- FIX-15 (optimistic locking embarque) → **v13.303.45**
- FIX-24 (`escapeOrIlike`) → Fase R
- FIX-25 (cotización vencida) → Fase R

**Pendientes reales** — objeto de esta fase.

---

## Alcance Fase 4

Ejecutamos los pendientes de mayor impacto financiero/operativo del Sprint 1, en 5 lotes atómicos.

### Lote A · Fechas de negocio America/Mexico_City (FIX-12)
Crear helper único `src/lib/date/mx.ts` con `hoyMX()` y `ymMX()` (Intl `en-CA` + `timeZone`). Reemplazar `toISOString().slice(0,10)` / `slice(0,7)` en:
- `supabase/functions/exchange-rates/index.ts` (elección de FIX del DOF)
- `supabase/functions/cxc-recordatorios/index.ts` (fecha vencimiento)
- `src/features/facturacion/services/dashboardEjecutivo.ts` (buckets mes)
- `src/features/embarques/components/TabTracking.tsx` (parseo de fechas locales)

**Verifica:** entre 18:00–23:59 CDMX, TC y "Facturado del mes" corresponden al día local.

### Lote B · CxP pago cross-currency correcto (FIX-14)
`src/features/cxp/components/usePagoProveedorForm.ts`:
- Aplicar `tcValido` (ya existe).
- Calcular `montoEnMonedaFactura = esUsdPagadoEnMxn && tc ? monto/tc : monto`.
- Bloquear submit si `esUsdPagadoEnMxn && !tc`.
- Prefill al cambiar moneda a MXN: `setMonto((saldo * tc).toFixed(2))`.
- Mostrar equivalente en UI ("≈ USD 1,000.00").

### Lote C · Factura manual íntegra (FIX-17) + NaN en costos (FIX-18)
- `src/features/facturacion/services/facturaManual.ts`: usar `sumarMontos` para el encabezado; validar `Number.isFinite` por concepto; folio borrador `BORRADOR-${Date.now()}-${uuid.slice(0,6)}`; si falla insert de conceptos → marcar `estado='Error'`.
- `src/features/cotizacion/components/TablaCostosLocal.tsx`: sanitizar input numérico (regex `[^0-9.]`), `parseFloat` con fallback 0.
- Migración: `COALESCE(...,0)` en RPC `actualizar_cotizacion_costos` para `costo_unitario` y `cantidad`.

### Lote D · IVA por línea con trigger BD (FIX-19)
Migración:
- Trigger `AFTER INSERT/UPDATE/DELETE` en `conceptos_factura` → recalcula `facturas.subtotal/iva/total`.
- Guardar `monto_iva` por concepto (columna nueva si no existe).
- Corregir `calc_pago_retenciones`: prorratear sobre `total`, no sobre `subtotal+iva`.
- Cliente `recalcularTotalesFactura.ts` queda como cálculo optimista pre-guardado; BD es fuente de verdad.

### Lote E · TC embarque desde fuente viva (FIX-20)
Migración: `ALTER TABLE embarques ALTER COLUMN tipo_cambio_usd DROP DEFAULT` (idem EUR). En el hook de creación, setear TC vigente vía `exchange-rates`; si no hay TC, dejar NULL (UI ya muestra "TC faltante" tras FIX-11).

### Lote F · Webhook FacturAPI: dedupe y límite body (FIX-22)
Migración: tabla `facturapi_webhook_events(event_id PK, org_id, procesado_at)`.
`facturapi-webhook/index.ts`:
- `if (body.length > 256*1024) return 413`.
- Insertar `event_id`; si viola PK → 200 (ya procesado).

### Lote G · Higiene menor (FIX-26, 27, 28, 30, 31, 32)
- **FIX-26** parser CFDI: quitar `slice(0,10)` del cuadre (mantener solo en resumen AI).
- **FIX-27** import BBVA: conservar signo, año siglo, dedupe con normalización.
- **FIX-28** conciliación: índices únicos parciales `uq_bbva_pago_factura` / `uq_bbva_pago_proveedor`; guard en update.
- **FIX-30** tarifas: RPC transaccional + validación monto > 0 en UI (quitar `filter` silencioso).
- **FIX-31** docs huérfanos storage: cleanup en `catch` del orchestrator.
- **FIX-32** `exchange-rates`: LRU 200 en `cacheHistorico` + validar componentes de fecha (rechazar 2025-02-30).

---

## Estrategia de ejecución

Ejecuto lotes A → G **en orden**, uno por commit lógico, con:
1. Cambios de código/migración.
2. Tests unitarios nuevos por lote (`tcValido`, `hoyMX`, cuadre CFDI, triggers IVA, dedupe webhook, conciliación única).
3. `bunx vitest run` de tests afectados + `bun run lint`.
4. Entrada en `CHANGELOG.md` + bump `APP_VERSION` (una versión por lote: v13.303.46 → v13.303.52).

Después de cada lote pauso brevemente para reporte antes del siguiente, para que puedas cancelar o reordenar.

## Fuera de alcance de esta fase

- Sprint 2 completo (FIX-33 a 39: UX sistémico) — plan separado tras terminar Sprint 1.
- Sprint 3 (FIX-40 a 48: gobierno/seguridad dura) — requiere revisión aparte, incluye cambios a CI y hosting.
- FIX-29 exports/imports con límites — depende del refactor de `DataTable`, se hace con Sprint 2.

## Detalles técnicos

- Migraciones respetan el patrón GRANT+RLS ya establecido.
- Se preserva `SECURITY DEFINER` / `SET search_path = public` en todas las funciones nuevas.
- Todos los helpers nuevos ≤200 líneas (Power of 10).
- Ningún cambio toca `src/components/ui/`, `types.ts` ni `.env`.
