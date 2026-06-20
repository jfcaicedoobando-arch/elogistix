# Fase 2 — Versionado de Cotizaciones y Reconciliación a 3 Columnas

## Objetivo

Cuando ventas re-cotiza una propuesta ya aceptada (o la operativa refresca tarifa), preservar el histórico de lo cotizado y permitir comparar **3 columnas** en reconciliación:

```text
┌─────────────┬───────────────────────┬─────────────┐
│  Cotizado   │  Refrescado al crear  │    Real     │
│ (aceptado)  │      embarque         │ (facturado) │
└─────────────┴───────────────────────┴─────────────┘
```

`cotizacion_costos` y `conceptos_venta` permanecen **inmutables** una vez aceptada la cotización: cualquier cambio crea una nueva versión.

---

## 1. Base de datos (migración única)

### 1.1 Versionado en `cotizaciones`

```sql
ALTER TABLE cotizaciones
  ADD COLUMN version INT NOT NULL DEFAULT 1,
  ADD COLUMN version_aceptada INT NULL,
  ADD COLUMN aceptada_en TIMESTAMPTZ NULL,
  ADD COLUMN aceptada_por UUID NULL REFERENCES auth.users(id);
```

### 1.2 Tablas históricas (espejo + version)

- `cotizacion_costos_historico` — espejo completo de `cotizacion_costos` + `cotizacion_id`, `version`, `archivada_en`, `archivada_por`.
- `conceptos_venta_historico` — espejo completo de `conceptos_venta` + `version`, `archivada_en`, `archivada_por`.
- `cotizacion_envios_historico` (opcional) — para auditar el PDF enviado por versión.

RLS por `organization_id` heredado, GRANT `authenticated` y `service_role`.

### 1.3 Trigger de versionado

`fn_archivar_version_cotizacion(p_cotizacion_id uuid, p_motivo text)`:
1. Copia filas vivas de `cotizacion_costos` y `conceptos_venta` a sus históricos con `version = cotizaciones.version`.
2. Incrementa `cotizaciones.version`.
3. Limpia tablas vivas (las nuevas filas se insertan después por el flujo de re-cotización).
4. Registra bitácora `cotizacion.versionada`.

Se invoca desde:
- RPC `recotizar_cotizacion(p_cotizacion_id, p_motivo)` — uso explícito de ventas.
- RPC `aceptar_cotizacion(p_cotizacion_id)` — fija `version_aceptada = version` y `aceptada_en/por`.

### 1.4 RPC de lectura

`obtener_cotizacion_version(p_cotizacion_id uuid, p_version int default null)`
- `version = null` → última activa.
- `version = version_aceptada` → la "verdad" para reconciliación.
- Devuelve costos + conceptos de venta de esa versión (mezclando vivas e históricas).

### 1.5 Reconciliación 3 columnas

Vista `vw_reconciliacion_embarque` (o RPC) que entrega por embarque/concepto:
- `cotizado` ← `cotizacion_costos_historico` filtrado por `cotizaciones.version_aceptada`.
- `refrescado` ← `embarques.tarifa_delta_jsonb` aplicado sobre cotizado (de Fase 1).
- `real` ← `conceptos_costo` actuales.
- Deltas absolutos y porcentuales para cada par.

---

## 2. Servicios y dominio (TypeScript)

- `src/lib/domain/versionadoCotizacion.ts`
  - `calcularDeltaCotizadoVsReal(cotizado, real)`
  - `calcularDeltaTresColumnas(cotizado, refrescado, real)`
  - `clasificarVarianza(deltaPct)` → `dentro_rango` | `alerta` | `critica` (umbrales en `configuracion_global`).
- `src/features/cotizacion/services/versionado/index.ts`
  - `recotizarCotizacion(id, motivo)` → llama RPC, invalida queries.
  - `aceptarCotizacion(id)` → fija versión aceptada.
  - `obtenerVersionCotizacion(id, version?)`.
- `src/features/embarques/services/reconciliacion.ts`
  - `obtenerReconciliacion3Columnas(embarqueId)`.

Errores tipados: `CotizacionYaAceptadaError`, `VersionNoEncontradaError`.

---

## 3. Hooks

- `useRecotizarCotizacion`
- `useAceptarCotizacion` (extiende el existente para fijar versión)
- `useVersionCotizacion(id, version?)`
- `useReconciliacion3Columnas(embarqueId)`
- `useHistorialVersiones(cotizacionId)` — lista versiones con metadatos.

---

## 4. UI

### 4.1 Cotización
- Botón "Re-cotizar" en `CotizacionDetalle` (sólo si `estado = aceptada` y rol ventas). Modal pide motivo, confirma con tipear `RECOTIZAR`.
- Selector de versión en header: "Versión 2 (activa) · Aceptada: v1".
- Badge "Histórica" cuando se ve una versión anterior, todo en read-only.
- Tab "Historial de versiones" con diff resumido.

### 4.2 Embarque
- Nueva tab "Reconciliación" (o sección en la actual) con tabla 3 columnas:

```text
Concepto      Cotizado    Refrescado    Real      Δ vs Cot    Δ vs Refr
Flete         $1,200      $1,260        $1,310    +9.2%       +4.0%
THC origen    $180        $180          $190      +5.6%       +5.6%
...
TOTAL         $2,450      $2,580        $2,720    +11.0%      +5.4%
```

- Tooltips por celda explicando el origen.
- Filtros: "Sólo con varianza > X%", "Sólo bloqueantes".
- Export a CSV.

### 4.3 Configuración global (`/admin/configuracion`)
- Card "Reconciliación de embarques": umbrales `varianza_alerta_pct` (default 5), `varianza_critica_pct` (default 15).

---

## 5. Bitácora y notificaciones

- Eventos: `cotizacion.versionada`, `cotizacion.aceptada_version_fijada`, `reconciliacion.varianza_critica_detectada`.
- Notificación interna a ventas y al owner del embarque cuando una varianza crítica se detecta al cerrar el embarque.

---

## 6. Tests

### Unitarios (Vitest)
- `versionadoCotizacion.test.ts` — math de deltas 2 y 3 columnas, clasificación.
- `services/versionado/index.test.ts` — mocks Supabase, errores tipados.
- `services/reconciliacion.test.ts` — combinación cotizado/refrescado/real.

### Hooks
- `useRecotizarCotizacion.test.tsx` — invalidación de queries, manejo de error `CotizacionYaAceptadaError`.
- `useReconciliacion3Columnas.test.tsx`.

### Componentes
- `RecotizarModal.test.tsx` — bloquea sin motivo, requiere tipeo de confirmación.
- `ReconciliacionTab.test.tsx` — render de 3 columnas, filtro por varianza, export CSV.

### Arquitectura
- Test que verifica que `cotizacion_costos` y `conceptos_venta` no se actualicen directamente fuera del flujo de versionado (regex en `src/`).

### E2E (`tests/e2e/09-versionado-reconciliacion.spec.ts`)
1. Ventas crea cotización → acepta → `version_aceptada = 1`.
2. Ventas re-cotiza → `version = 2`, histórico v1 intacto.
3. Operativa crea embarque, refresca tarifa (Fase 1).
4. Captura conceptos reales → reconciliación muestra 3 columnas y deltas.
5. Cambia umbrales en configuración → varianzas se reclasifican.

### Canary
- Contract test del RPC `obtener_cotizacion_version` (shape estable).
- Snapshot del payload de `vw_reconciliacion_embarque` para un embarque seed.

---

## 7. Migración de datos existentes

Backfill idempotente:
- Para toda `cotizacion` con `estado = aceptada` y `version_aceptada IS NULL`:
  - `version_aceptada = 1`, `aceptada_en = updated_at`, `aceptada_por = creada_por`.
- No se copian filas al histórico (la v1 vive en las tablas vivas hasta la primera re-cotización).

---

## 8. Versionado y memoria

- `APP_VERSION` → `13.71.0`.
- `CHANGELOG.md`: entrada Fase 2.
- Nueva memoria `mem://features/versionado-cotizaciones-reconciliacion` con el contrato (inmutabilidad, RPCs, 3 columnas).
- Actualizar `mem://features/revalidacion-tarifa-embarque` para enlazar la columna "refrescado" con esta fase.

---

## 9. Orden de ejecución

1. Migración SQL (tablas históricas + columnas + triggers + RPCs + vista + backfill).
2. Tipos TS regenerados (automático tras aprobar migración).
3. Dominio + servicios + tests unitarios.
4. Hooks + tests.
5. UI cotización (re-cotizar + selector versión + historial).
6. UI embarque (tab reconciliación 3 columnas).
7. Configuración de umbrales.
8. E2E + canary.
9. Bump versión + changelog + memoria.

## Fuera de alcance (Fase 3 futura)
- Diff visual entre versiones lado a lado.
- Aprobación por flujo (workflow) de re-cotizaciones.
- Reconciliación a nivel proveedor/factura.
