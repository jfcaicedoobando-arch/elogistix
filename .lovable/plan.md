
# Revalidación de tarifa cotización → embarque

## Objetivo

Hacer del **embarque la fuente de verdad de costos**, manteniendo el **precio al cliente inmutable** salvo re-aprobación explícita de ventas. Al convertir una cotización aceptada en embarque, el sistema revalida la tarifa vinculada contra `costeo_tarifas_vigentes_v` y decide entre conversión directa, modal informativo o bloqueo con re-aprobación.

## Fases

Implementación dividida en 2 fases. Esta entrega cubre **Fase 1** completa. Fase 2 (versionado de cotizaciones + reconciliación a 3 columnas) queda esbozada al final como follow-up.

---

## Fase 1 — Revalidación + trazabilidad (este plan)

### 1. Base de datos (migración)

Nueva migración con:

- **Columnas en `embarques`**:
  - `tarifa_id_original UUID` (FK `costeo_tarifas` ON DELETE SET NULL)
  - `tarifa_id_aplicada UUID` (FK `costeo_tarifas` ON DELETE SET NULL)
  - `tarifa_delta_jsonb JSONB` (snapshot del delta detectado)
  - `tarifa_decision TEXT` con CHECK in (`sin_cambios`, `mantenida_por_operaciones`, `refrescada`, `sustituida`, `reaprobada_ventas`)
  - `tarifa_revalidada_en TIMESTAMPTZ`
  - `tarifa_revalidada_por UUID` (FK `auth.users`)

- **Columnas en `cotizaciones`**:
  - `estado_revalidacion TEXT` con CHECK in (`ninguna`, `pendiente_reaprobacion`, `reaprobada`, `rechazada`)
  - `revalidacion_solicitada_en TIMESTAMPTZ`
  - `revalidacion_resuelta_en TIMESTAMPTZ`

- **Configuración** (rows en `configuracion`, categoría `operaciones`):
  - `tarifa_revalidacion_umbral_pct` (default `5`)
  - `tarifa_revalidacion_bloquea_si_vencida` (default `true`)

- **RPC `revalidar_tarifa_cotizacion(p_cotizacion_id UUID)`** SECURITY DEFINER, org-scoped:
  - Lee `cotizaciones.tarifa_id` + costos asociados.
  - Consulta `costeo_tarifas_vigentes_v` y `costeo_tarifa_recargos` actuales.
  - Devuelve JSON con: `tarifa_vigente` (bool), `cambios[]` (concepto, monto anterior/actual, delta absoluto y %), `severidad` (`sin_cambios` | `informativa` | `bloqueante`), `agente_sin_cupo` (bool).

- **RPC `crear_embarque_borrador_desde_cotizacion` actualizada** para aceptar `p_decision TEXT` y `p_tarifa_id_aplicada UUID` opcionales y persistirlos en el embarque junto con `tarifa_delta_jsonb`.

- **Trigger / función** que cuando `tarifa_decision = 'reaprobada_ventas'` inserta en `notificaciones_internas` un aviso al `cotizaciones.operador`.

### 2. Servicios (TypeScript)

- `src/features/cotizacion/services/revalidacion/index.ts`:
  - `revalidarTarifa(cotizacionId: string): Promise<ResultadoRevalidacion>` — invoca RPC.
  - `solicitarReaprobacionVentas(cotizacionId, delta)` — marca `estado_revalidacion = pendiente_reaprobacion`, crea bitácora.
  - `resolverReaprobacion(cotizacionId, decision: 'reaprobada' | 'rechazada')` — actualiza estado + bitácora.

- `src/features/cotizacion/services/conversiones/embarques.ts` (modificado): antes de llamar a la RPC, ejecuta `revalidarTarifa` y propaga el `ResultadoRevalidacion` al caller. Si `severidad === 'bloqueante'` y no hay decisión previa, lanza error tipado `RevalidacionRequeridaError` que la UI captura.

- `src/lib/domain/revalidacionTarifa.ts` (puro, testeable):
  - `clasificarSeveridad(cambios, umbralPct, vencida, bloqueaSiVencida)` → `'sin_cambios' | 'informativa' | 'bloqueante'`.
  - `calcularDeltaPct(anterior, actual)`.
  - `resumirDelta(cambios)` para bitácora.

### 3. Hooks

- `useRevalidarTarifa(cotizacionId)` — query con `staleTime` 0, no-auto-refetch.
- `useCrearEmbarqueBorrador` (existente) extendido para aceptar `decision` y `tarifaIdAplicada`.
- `useSolicitarReaprobacion`, `useResolverReaprobacion` — mutations con `notifyError/notifySuccess` y bitácora.

### 4. UI

- **`RevalidarTarifaModal.tsx`** (`src/features/cotizacion/components/revalidacion/`):
  - 3 modos según severidad: sin cambios (auto-cierra), informativa (tabla de deltas + botones Mantener/Refrescar), bloqueante (mensaje + botón Solicitar re-aprobación).
  - Tabla con concepto, monto cotización, monto vigente, delta MXN/USD, delta %.

- **Integración en botones "Crear embarque"** (`CotizacionDetalle.tsx` y lista de cotizaciones): interceptan click, abren modal si revalidación lo requiere.

- **Banner en `CotizacionDetalle.tsx`** cuando `estado_revalidacion = 'pendiente_reaprobacion'`: muestra delta y acciones para ventas (re-aprobar manteniendo precio cliente / re-cotizar / rechazar).

- **Badge en lista de cotizaciones**: chip "Tarifa vencida" / "Pendiente re-aprobación".

- **Sección "Origen de costos" en `EmbarqueDetalle.tsx`**: muestra `tarifa_decision`, link a tarifa original/aplicada, render del `tarifa_delta_jsonb` colapsable.

### 5. Bitácora

Todas las acciones (`revalidacion_detectada`, `tarifa_refrescada`, `tarifa_mantenida`, `reaprobacion_solicitada`, `reaprobacion_resuelta`) se registran vía `insertBitacora` con módulo `cotizaciones` o `embarques` y `detalles` con el delta resumido.

### 6. Configuración

Card nuevo en `/admin/configuracion` → categoría "Operaciones": editor de umbral % (slider 0-50) y switch "Bloquear si tarifa vencida". Schema Zod en `configSchemas.ts`.

---

## Tests

### Unit (Vitest)

- `src/lib/domain/__tests__/revalidacionTarifa.test.ts`
  - `clasificarSeveridad`: matriz (vencida sí/no × delta < / = / > umbral × bloqueaSiVencida sí/no).
  - `calcularDeltaPct`: edge cases (anterior = 0, signos).
  - `resumirDelta`: agrupa por moneda, orden estable.

- `src/features/cotizacion/services/revalidacion/__tests__/index.test.ts`
  - Mock supabase chain: rpc devuelve OK, error, payload mal formado.
  - `solicitarReaprobacionVentas` escribe en `cotizaciones`, `bitacora_actividad` y `notificaciones_internas` (verifica payloads).
  - `resolverReaprobacion` rechaza si estado != `pendiente_reaprobacion`.

- `src/features/cotizacion/services/conversiones/__tests__/embarques.test.ts` (extiende existente)
  - Caso `severidad = sin_cambios` → conversión directa.
  - Caso `informativa` sin decisión → lanza `RevalidacionRequeridaError`.
  - Caso `bloqueante` sin reaprobación → lanza.
  - Caso `reaprobada_ventas` → RPC recibe `p_decision` y `p_tarifa_id_aplicada` correctos.

- `src/features/cotizacion/hooks/__tests__/useRevalidarTarifa.test.tsx`
  - Estado loading, success con cada severidad, error.

- `src/features/cotizacion/components/revalidacion/__tests__/RevalidarTarifaModal.test.tsx`
  - Render por severidad, botones disparan callback correcto, accesibilidad básica (roles, labels), cleanup tras cerrar.

### Architecture

- `src/__tests__/architecture/revalidacion-tarifa.test.ts`
  - `services/revalidacion` no importa de `components/`.
  - `RevalidarTarifaModal` no llama a `supabase` directo.
  - RPC `revalidar_tarifa_cotizacion` mencionada en exactamente un servicio.

### E2E (Playwright)

- `e2e/specs/08-revalidacion-tarifa.spec.ts`
  - Login → cotización con tarifa vigente → crear embarque → no aparece modal.
  - Cotización con tarifa expirada → aparece modal bloqueante → solicitar re-aprobación → banner en detalle → ventas re-aprueba → permite crear embarque → verifica `tarifa_decision = reaprobada_ventas` en UI de embarque.
  - Caso delta informativo → operación elige "Refrescar" → embarque queda con `tarifa_decision = refrescada` y `conceptos_costo` reflejan precios nuevos.

### Canary

- `src/test/canaries/revalidacionTarifaContract.test.ts` — schema Zod del payload de la RPC; falla si la BD agrega/quita campos sin actualizar el contrato TS.

---

## Versionado y memoria

- `APP_VERSION` → `13.70.0`.
- `CHANGELOG.md`: nueva entrada `## [13.70.0] - 2026-06-19` con bullets de revalidación, modal, re-aprobación, trazabilidad, tests.
- Nueva memoria `mem://features/revalidacion-tarifa-embarque` + entrada en `mem://index.md`.

---

## Fuera de alcance (Fase 2, follow-up)

- Versionado de `cotizacion_costos` con tabla histórica.
- `cotizaciones.version` y `version_aceptada`.
- Tab de reconciliación a 3 columnas (cotizado / refrescado / real).
- Emails transaccionales al cliente cuando ventas re-aprueba con cambio de precio.

---

## Detalles técnicos relevantes

```text
Flujo:
  [Crear embarque] → revalidarTarifa(RPC)
        ├─ sin_cambios     → RPC crear_embarque (p_decision='sin_cambios')
        ├─ informativa     → Modal → operaciones elige
        │     ├─ Mantener  → RPC (decision='mantenida_por_operaciones')
        │     └─ Refrescar → RPC (decision='refrescada', tarifa_id_aplicada=vigente)
        └─ bloqueante      → Modal → solicitar re-aprobación
                              └─ notif interna a ventas
                                    └─ ventas re-aprueba en banner
                                          └─ RPC (decision='reaprobada_ventas')
```

Tipo TS principal:

```ts
interface ResultadoRevalidacion {
  tarifa_vigente: boolean;
  agente_sin_cupo: boolean;
  severidad: 'sin_cambios' | 'informativa' | 'bloqueante';
  cambios: Array<{
    concepto: string;
    moneda: 'USD' | 'MXN';
    monto_anterior: number;
    monto_actual: number;
    delta_abs: number;
    delta_pct: number;
  }>;
  umbral_pct: number;
}
```

¿Apruebas para implementar Fase 1 completa con todos los tests?
