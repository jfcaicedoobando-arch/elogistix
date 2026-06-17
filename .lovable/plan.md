# Bloque S — Cierre Financiero del Embarque

Congela el embarque al final de su ciclo de vida: bloquea ediciones, valida integridad financiera, devenga la comisión definitiva del vendedor y deja constancia auditable. Reapertura controlada con justificación.

## 1. Cambios en Base de Datos

### 1.1 Nuevo estado `cerrado` en `embarques`
- Agregar `cerrado` al CHECK/enum de `estatus` en `embarques` (después de `entregado`).
- Nuevas columnas en `embarques`:
  - `cerrado_at timestamptz`
  - `cerrado_por uuid` → `auth.users.id`
  - `cerrado_snapshot jsonb` (P&L y totales congelados al momento del cierre)
  - `reabierto_at timestamptz`, `reabierto_por uuid`, `reabierto_motivo text`

### 1.2 Tabla `cierre_embarque_log`
Bitácora de cada cierre/reapertura: `embarque_id`, `accion` (`cerrar` | `reabrir`), `usuario_id`, `motivo`, `snapshot jsonb`, `created_at`.
- RLS multi-tenant por `organization_id`.
- GRANT a `authenticated` y `service_role`.

### 1.3 Tabla `cierre_validaciones`
Catálogo de checks ejecutados (por embarque y cierre): `regla` (`cxc_sin_pendientes`, `cxp_sin_pendientes`, `documentos_completos`, `pnl_margen_minimo`, `comision_calculada`), `paso boolean`, `detalle jsonb`. Permite mostrar el checklist en UI antes de cerrar.

### 1.4 RPC `validar_cierre_embarque(p_embarque_id uuid)`
SECURITY DEFINER. Retorna `jsonb`:
```json
{ "puede_cerrar": false, "checks": [{ "regla":"cxc_sin_pendientes","ok":true }, ...] }
```
Reglas:
- **CxC**: no existen facturas con `saldo > 0` no canceladas para el embarque.
- **CxP**: todas las `proveedor_facturas` con `estatus in ('pagada','conciliada')`.
- **Documentos**: checklist mínimo (BL, factura cliente, factura proveedor principal) presente en `documentos_embarque`.
- **P&L**: utilidad >= umbral en `configuracion_global` (`pnl_margen_minimo_cierre`, default 0).
- **Comisión**: existe registro en `comisiones_devengadas` consistente con P&L real.

### 1.5 RPC `cerrar_embarque(p_embarque_id uuid)`
SECURITY DEFINER. Flujo transaccional:
1. Verifica rol (`admin`, `super_admin`, `contador`) vía `has_role`.
2. Llama `validar_cierre_embarque`; aborta si algún check falla.
3. Snapshot del P&L (reusa `pnl_financiero_embarque`) y de totales (CxC/CxP, conceptos, seguros).
4. Marca `comisiones_devengadas.definitiva = true` con monto basado en P&L real.
5. Actualiza `embarques.estatus='cerrado'`, `cerrado_at`, `cerrado_por`, `cerrado_snapshot`.
6. Inserta fila en `cierre_embarque_log` (`accion='cerrar'`).
7. Registra en `bitacora_actividad`.

### 1.6 RPC `reabrir_embarque(p_embarque_id uuid, p_motivo text)`
- Solo `super_admin` o `admin` con motivo obligatorio (>=20 caracteres).
- Revierte `comisiones_devengadas.definitiva = false`.
- `estatus` vuelve a `entregado`; limpia `cerrado_*` pero conserva snapshot histórico en el log.
- Inserta `cierre_embarque_log` (`accion='reabrir'`).

### 1.7 Triggers de bloqueo de edición
Triggers `BEFORE INSERT/UPDATE/DELETE` que lanzan excepción si el embarque está en `cerrado` (excepto el propio RPC `reabrir_embarque`):
- `conceptos_costo`, `conceptos_venta`, `documentos_embarque`, `seguros_embarque`, `eventos_embarque`, `embarque_contenedores`, `facturas` (ligadas al embarque), `proveedor_facturas`, `pagos_factura`, `pagos_proveedor`.

Mecanismo: cada trigger consulta `embarques.estatus`; si es `cerrado`, `RAISE EXCEPTION 'Embarque cerrado: edición bloqueada'` salvo cuando `current_setting('app.bypass_cierre', true) = 'on'` (lo activa la RPC `reabrir_embarque`).

### 1.8 Comisiones devengadas
Asegurar columnas en `comisiones_devengadas`: `definitiva boolean default false`, `pnl_base numeric`, `calculo_snapshot jsonb`.

## 2. Reglas de Negocio

- **Quién cierra**: `admin`, `super_admin`, `contador`. Tesorero/cobranza solo consultan.
- **Quién reabre**: `super_admin` siempre; `admin` si configuración lo permite.
- **Cuándo cierra**: estado origen debe ser `entregado` y todos los checks de `validar_cierre_embarque` en verde.
- **Comisión definitiva**: se calcula sobre P&L real (ingresos cobrados − costos pagados) usando la fórmula vigente del vendedor; queda inmutable salvo reapertura.
- **Visibilidad**: embarques `cerrado` se muestran en bandejas operativas como solo lectura; en módulo financiero se filtran por “Cerrados/Abiertos”.
- **Auditoría**: cada cierre/reapertura escribe en `cierre_embarque_log` y `bitacora_actividad`.

## 3. Flujo de Estados

```text
borrador → confirmado → en_transito → en_destino → entregado → cerrado
                                                       ↑          │
                                                       └── reabrir ┘ (con motivo)
```

- Solo `entregado → cerrado` está permitido, vía RPC `cerrar_embarque`.
- `cerrado → entregado` solo vía RPC `reabrir_embarque` con motivo.
- Cualquier otro intento de cambiar estatus desde/hacia `cerrado` se rechaza por trigger.

## 4. Frontend

### 4.1 Servicios y hooks
- `src/features/embarques/services/cierre.ts`: `validarCierre`, `cerrarEmbarque`, `reabrirEmbarque`, `getCierreLog`.
- `src/features/embarques/hooks/useCierreEmbarque.ts`: React Query (queries + mutations) e invalida `embarque-detalle`, `pnl-financiero`, `comisiones`.

### 4.2 Componentes
- `TabCierre.tsx` (nueva pestaña en `EmbarqueDetalleTabs`):
  - Checklist visual de `validar_cierre_embarque` (semáforo por regla, con detalle).
  - Resumen P&L final (reusa componente existente).
  - Comisión devengada estimada vs definitiva.
  - Botón **Cerrar embarque** (deshabilitado si algún check rojo) con diálogo de confirmación tipo ELIMINAR (typing `CERRAR`).
  - Si está cerrado: badge “Cerrado el dd/mm/aaaa por X”, snapshot y botón **Reabrir** (rol-gated, requiere motivo en textarea ≥20 chars).
  - Historial (`cierre_embarque_log`) en tabla compacta.
- Badge global en header del embarque: `Cerrado` / `Abierto`.
- Banner solo-lectura en demás tabs cuando `estatus='cerrado'`.

### 4.3 Permisos UI (`usePermissions`)
- `puedeCerrarEmbarque`: admin, super_admin, contador.
- `puedeReabrirEmbarque`: super_admin (y admin si config global lo habilita).

### 4.4 Bandejas
- Filtro `Incluir cerrados` (default OFF) en bandejas de Cartera, CxP y operativas.
- Indicador de candado en filas cerradas.

## 5. Configuración Global
Nuevas claves en `configuracion_global`:
- `pnl_margen_minimo_cierre` (numeric, default `0`)
- `cierre_admin_puede_reabrir` (boolean, default `false`)
- `cierre_documentos_requeridos` (jsonb: lista de `tipo_documento`)

UI en módulo Configuración → sección “Cierre Financiero”.

## 6. Versionado y Changelog
- Bump `APP_VERSION` a `13.56.0`.
- Entrada en `CHANGELOG.md`: nuevo bloque, RPC, triggers, UI, permisos.

## 7. Orden de Implementación
1. Migración 1: enum/check, columnas, tabla `cierre_embarque_log`, `cierre_validaciones`, columnas en `comisiones_devengadas`, configuración global.
2. Migración 2: RPCs `validar_cierre_embarque`, `cerrar_embarque`, `reabrir_embarque` + triggers de bloqueo.
3. Servicios + hooks + permisos.
4. UI: `TabCierre`, badge global, banner read-only, filtros en bandejas.
5. Configuración global UI.
6. Tests: `validar_cierre_embarque` (verde/rojo), bloqueo por trigger, reapertura, comisión definitiva.
7. Changelog + bump versión.

## 8. Riesgos y Mitigación
- **Triggers globales pueden romper flujos legacy** → bypass controlado vía `SET LOCAL app.bypass_cierre = 'on'` dentro de RPC autorizada.
- **Snapshot pesado** → almacenar solo agregados, no filas detalle.
- **Reapertura inconsistente con facturación ya cerrada fiscalmente** → la reapertura no toca facturas emitidas; solo levanta el bloqueo operativo.
