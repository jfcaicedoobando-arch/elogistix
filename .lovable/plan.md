## Objetivo
Ampliar la cobertura de Playwright con 4 nuevos specs (09–12) gateados por flag, con mutaciones reales sobre staging y cleanup best-effort.

## Convenciones comunes

- Cada spec se salta con `test.skip(...)` si falta su flag/env requerido.
- Mutaciones envueltas en `try/finally`; el cleanup intenta dejar el dato en estado previo (o lo marca como "creado por E2E" para barrido manual).
- Selectores estables: `getByRole` + nombres anclados; nunca `text=` ambiguo.
- Esperas con `waitForResponse` sobre `/rest/v1/<tabla>` o sobre `/functions/v1/<edge>` en vez de `waitForTimeout`.
- Todos los specs corren en project `chromium-internal` salvo aclaración.

## Specs nuevos

### 09 — Cierre de embarque
**Archivo:** `e2e/specs/09-cierre-embarque.spec.ts`
**Flag:** `E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID` (UUID de un embarque con checklist incompleto, en estado `en_transito`/`arribado`).
**Cobertura:**
1. Login interno, ir a `/embarques/<id>?tab=cierre`.
2. Validar que `CierrePendientesCard` lista ≥1 pendiente.
3. Botón "Cerrar embarque" deshabilitado → hover muestra tooltip "Faltan N pendientes".
4. Si `E2E_ADMIN_ORG=1`, intentar cerrar con bypass: click "Cerrar embarque" → confirmar → esperar `waitForResponse(/cerrar_embarque/)` y validar badge "Cerrado".
5. **Cleanup:** RPC `reabrir_embarque` (si existe) o `UPDATE embarques SET estado='arribado' WHERE id=...` vía fetch a una edge function helper. Si no hay helper, log warning y dejar nota.

### 10 — Auditoría operativa (bulk + snooze)
**Archivo:** `e2e/specs/10-auditoria-bulk.spec.ts`
**Flag:** `E2E_HAS_AUDIT_DATA=1` (asume `auditoria_embarques_org` devuelve ≥3 hallazgos).
**Cobertura:**
1. Login interno, ir a `/auditoria`.
2. Esperar respuesta de RPC `auditoria_embarques_org`; validar tabla con ≥3 filas.
3. Seleccionar 3 hallazgos vía checkbox de fila.
4. Validar `HallazgosBulkBar` visible con "3 seleccionados".
5. Click "Marcar revisados" → confirmar diálogo → esperar `waitForResponse(/auditoria_revisiones/)`.
6. Validar toast de éxito y que los 3 hallazgos desaparecen/cambian de estado.
7. Snooze: en un hallazgo, abrir menú, intentar snooze 35 días → validar error "máximo 30 días".
8. Snooze válido (15 días) → validar badge "Snoozed hasta DD/MM/YYYY".
9. **Cleanup:** des-marcar revisados vía `DELETE` en `auditoria_revisiones` no es trivial desde el cliente; usar `try/finally` con un comentario "creado por E2E" en `motivo` y dejar barrido manual.

### 11 — Cotización → embarque
**Archivo:** `e2e/specs/11-cotizacion-a-embarque.spec.ts`
**Flag:** `E2E_COTIZACION_ACEPTADA_ID` (UUID de cotización en estado `aceptada` sin embarque vinculado).
**Cobertura:**
1. Login interno, ir a `/cotizaciones/<id>`.
2. Validar badge `ACEPTADA`.
3. Click "Convertir a embarque" → confirmar.
4. Esperar `waitForResponse(/crear_embarque_borrador_desde_cotizacion/)`.
5. Validar redirección a `/embarques/<nuevo-id>?...`.
6. Validar heading con expediente `EL(IMP|EXP|GEN)\d+` y badge `cotizacion_id` vinculada.
7. **Cleanup:** capturar `nuevo-id`; en `afterEach` intentar `DELETE` vía RPC `eliminar_embarque_borrador` si existe, o dejar marcado con `notas="E2E_CLEANUP"`.

### 12 — CXP: captura factura proveedor + pago
**Archivo:** `e2e/specs/12-cxp-factura-pago.spec.ts`
**Flag:** `E2E_PROVEEDOR_ID` + `E2E_EMBARQUE_PARA_CXP_ID`.
**Cobertura:**
1. Login interno, ir a `/compras/por-capturar`.
2. Capturar nueva factura proveedor: abrir modal, llenar monto/moneda/proveedor/embarque, guardar.
3. Esperar `waitForResponse(/proveedor_facturas/)`; validar folio `FP-\d{6}` asignado.
4. Ir a `/compras/facturas-proveedor`, localizar factura por folio.
5. Registrar pago: abrir modal, monto = total, forma de pago, guardar.
6. Esperar `waitForResponse(/pagos_proveedor/)`; validar badge "Pagado".
7. **Cleanup:** `try/finally` con `DELETE` vía RPC `eliminar_proveedor_factura_e2e` (a crear si no existe) o marcar `referencia='E2E_TEST'` para barrido.

## Helpers a agregar

- `e2e/fixtures/cleanup.ts` — wrapper `bestEffortCleanup(fn)` que loguea pero no rompe el spec si falla.
- `e2e/fixtures/api.ts` — fetch directo a `${BASE_URL}/rest/v1/...` o edge functions con el token del storageState para cleanups server-side.
- Extender `playwright.config.ts`: no requiere proyectos nuevos; todos viven en `chromium-internal`.

## Documentación

- Actualizar `e2e/README.md` con las nuevas env vars y cómo sembrar datos:
  - `E2E_EMBARQUE_CHECKLIST_INCOMPLETO_ID`
  - `E2E_ADMIN_ORG=1` (opcional)
  - `E2E_HAS_AUDIT_DATA=1`
  - `E2E_COTIZACION_ACEPTADA_ID`
  - `E2E_PROVEEDOR_ID`, `E2E_EMBARQUE_PARA_CXP_ID`

## Versionado

- Bump `APP_VERSION` a `13.139.9` y entrada en `CHANGELOG.md` describiendo los 4 specs nuevos + helpers.

## Detalles técnicos

- No tocar `src/`: cambios sólo en `e2e/`, `playwright.config.ts` (si hace falta), `CHANGELOG.md` y `appVersion.ts`.
- Edge functions de cleanup (si terminan siendo necesarias): a evaluar en la implementación; idealmente reutilizamos RPCs ya existentes con permisos del usuario E2E.
- `serial` mode para 12 (captura → pago dependen en orden); los demás independientes.
