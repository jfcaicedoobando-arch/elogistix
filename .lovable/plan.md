# Wave 17 · Cierre de bugs BAJA + 1 MEDIA en CRM y Embarques

Aplicaremos 4 correcciones frontend de bajo riesgo del archivo `instrucciones-lovable-bugs-e2e-2026-07-28-2.md`. Ninguna toca lógica de dinero ni migraciones SQL nuevas.

## Bugs incluidos

### B-034 · Oportunidad "Ganada" sin `fecha_cierre_real` / `valor_real` (🟡 MEDIA)
Contradicción entre Resumen (usa `monto_estimado`) y Leaderboard (usa `fecha_cierre_real`).
- En `NuevaOportunidadDialog`, cuando la etapa es tipo `ganada`, mostrar campos **Fecha de cierre real** (obligatoria, default hoy) y **Valor real** (default `monto_estimado`).
- En kanban `handleMover`: al soltar en etapa `ganada` escribir automáticamente `fecha_cierre_real = hoy` y `valor_real = monto_estimado`.
- Extender `moverEtapaOportunidad` y `useMoverEtapaConAutomatizacion` con esos campos opcionales.

### B-055 · Actividades CRM sin distinción "Vencida" (⚪ BAJA)
- `Actividades.tsx`: badge "Vencida" cuando `fecha_completada == null && fecha_programada < now`.
- `statusRegistry.ts`: agregar `"Vencida"` a `DOMAIN_STATUSES.actividad_crm`.
- `services/actividades.ts`: `listActividadesVencidas` / `countActividadesVencidas` filtran por `responsable_id` OR `responsable_email` cuando hay email.

### B-057 · Tab Costos muestra "Ahorro 100%" en costos sin factura (⚪ BAJA)
- `ajusteDescripcion.ts`: `describirAjusteNeto` acepta `sinFactura` y excluye del cálculo los renglones sin factura de proveedor; rotula "· N sin factura" o "Sin factura proveedor".
- Actualizar llamadas en `ResumenAjusteBar` y `GrupoCostosProveedor` para pasar el conteo.
- Tiles "Cotizado/Facturado" se mantienen sin cambios.

### B-058 · Embarque Entregado sin acción "Cancelar" (⚪ BAJA)
La BD ya permite `* → Cancelado` vía `avanzar_estado_embarque`, pero la UI no lo expone.
- `useEmbarqueEstadoActions`: nuevo `handleCancelar` que llama `avanzarEstado.mutateAsync({ nuevoEstado: "Cancelado" })` + bitácora (`cambiar_estado`) + toast.
- `EmbarqueDetalleHeaderActions`: nueva entrada "Cancelar embarque" con `ConfirmActionDialog` destructivo, visible en cualquier estado ≠ Cancelado; descripción advierte que no revierte pagos/facturas/docs si estado es Entregado/EIR/Cerrado.
- Ocultar "Eliminar" cuando hay deuda vinculada (usar `useValidacionCierre` / `validar_cierre_embarque`).

## Verificación
- `bun run lint -- --max-warnings 0`
- `bun test src/features/crm src/features/embarques/components/costos` (targeted)
- Verificar en preview: Oportunidad → mover a ganada, Actividades vencidas badge rojo, tab Costos sin ahorro fantasma, embarque Entregado permite Cancelar.

## Post
- Bump `APP_VERSION` a `13.320.53`.
- Entrada en `CHANGELOG.md`.
- Reportar: 56/63 cerrados, 7 pendientes (B-010, B-011, B-013, B-020, B-029, B-042, B-044 + diagnósticos B-012/B-021/B-059).
