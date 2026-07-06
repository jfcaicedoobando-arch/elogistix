
# Extender cobertura de bitácora a módulos nuevos

## Diagnóstico

La bitácora (`bitacora_actividad`) está desactualizada:

**Sin registro alguno** (implementados en olas recientes):
- CxP: alta/edición/pago/cancelación de facturas de proveedor, notas de crédito, retenciones.
- Facturación emitida: emisión CFDI, cancelación, NC, REP (hoy sólo se guarda en `app_logs` del edge function, no visible al usuario).
- Costeo: tarifas marítimas, condiciones naviera, demoras, garantías.
- Comisiones y liquidaciones.
- Configuración global y presupuestos.

**Inconsistencias en UI** (`src/features/dashboard/routes/Bitacora.tsx`):
- Faltan opciones `crm`, `auditoria`, `cxp`, `costeo`, `comisiones`, `configuracion`, `facturacion`, `retenciones`.
- Valores mezclados con mayúsculas (`"Embarques"` vs `"embarques"`) desde `paso1Crm.ts` y `bitacoraTarifa.ts`.

## Alcance

### 1. Helper único de bitácora (frontend)
Crear `src/lib/domain/bitacora/registrar.ts` con:
- `registrarActividad({ modulo, accion, entidad, entidadId, descripcion, detalles })`.
- Toma `auth.getUser` internamente, no lanza (fire-and-forget con `console.warn`).
- Constante `MODULOS_BITACORA` como single source of truth (kebab lowercase).

Migrar los 5 puntos actuales (`paso1Crm`, `prospecto`, `bitacoraTarifa`, `bitacoraEmbarque`, `cierre`, `loginAudit`) a este helper y **normalizar valores a minúsculas** (`embarques`, `cotizaciones`).

### 2. Puntos nuevos de registro
Añadir llamada a `registrarActividad` en:

| Módulo | Archivo/hook | Acciones |
|---|---|---|
| `cxp` | `useCrearFacturaProveedor`, `useActualizarFacturaProveedor`, `useCancelarFacturaProveedor`, `useRegistrarPagoProveedor`, `useCrearNotaCreditoProveedor` | `crear`, `editar`, `cancelar`, `pagar` |
| `facturacion` | `facturapi-emitir/index.ts`, `facturapi-emitir-nota-credito`, `facturapi-emitir-rep`, `facturapi-cancelar` (edge functions → escribir a `bitacora_actividad` con user_id de la request) | `emitir`, `cancelar`, `emitir_nc`, `emitir_rep` |
| `costeo` | Hooks CRUD de `costeo_tarifas`, `costeo_navieras_condiciones`, `costeo_tarifa_recargos`, `costeo_naviera_demoras_tarifa` | `crear`, `editar`, `eliminar` |
| `comisiones` | Servicios `liquidaciones_comision`, `comisiones_devengadas` | `liquidar`, `ajustar` |

Retenciones NO tendrán módulo propio: se registran como `detalles.retenciones` dentro del evento de `cxp` o `facturacion`.

### 3. UI del catálogo
Actualizar `src/features/dashboard/routes/Bitacora.tsx`:
- Importar `MODULOS_BITACORA` desde el helper.
- Añadir entradas: CxP, Facturación, Costeo, CRM, Auditoría, Comisiones, Configuración.
- Extender `GRUPOS_ACCION` en `src/lib/domain/bitacoraDescripcion.ts` con verbos nuevos: `pagar`, `liquidar`, `emitir`, `cancelar`, `timbrar`.

### 4. Descripciones legibles
Ampliar `bitacoraDescripcion.ts` con plantillas por (`modulo`, `accion`) para los eventos nuevos, ej:
- `cxp.crear` → "Registró factura de proveedor {folio}"
- `facturacion.emitir` → "Timbró factura {serie}-{folio} por {monto}"
- `costeo.crear` → "Creó tarifa {ruta} en {naviera}"

### 5. Tests
- Extender `bitacoraDescripcion.test.ts` con casos nuevos.
- Test unitario del helper `registrarActividad` (mock supabase).
- Un test por hook nuevo verificando que llama a `bitacora_actividad` en éxito.

### 6. Migración BD
No requiere cambios de esquema — `bitacora_actividad` ya es genérica. Sólo confirmar índices existentes sobre `(modulo, created_at)` vía `supabase--linter` en fase de implementación.

### 7. Changelog + versión
- Bump `APP_VERSION` (patch).
- Entrada `## [X.Y.Z]` con bullets por módulo agregado.

## Detalles técnicos

```text
src/lib/domain/bitacora/
├── registrar.ts        (helper único + MODULOS_BITACORA)
└── __tests__/registrar.test.ts

Modificados:
- Bitacora.tsx                       (dropdown desde MODULOS_BITACORA)
- bitacoraDescripcion.ts             (grupos + plantillas nuevas)
- features/cxp/hooks/*                (~5 hooks)
- features/costeo/hooks/*             (~4 hooks)
- features/comisiones/services/*
- supabase/functions/facturapi-*      (4 edge functions)
- Migraciones existentes de olas: normalizar strings mayúscula → minúscula
```

Edge functions escriben directo a `bitacora_actividad` usando `service_role` + `user_id` extraído del JWT de la petición (patrón ya usado en `authenticateRequest`).

## Fuera de alcance

- Reescribir la vista de timeline por entidad (`useActividadEmbarque`) — sigue funcional.
- Exportar bitácora a CSV/Excel.
- Retención por 90 días / archivado automático.
