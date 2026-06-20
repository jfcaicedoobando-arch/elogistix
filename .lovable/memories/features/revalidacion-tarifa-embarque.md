---
name: Revalidación de tarifa cotización → embarque
description: Al convertir cotización aceptada en embarque, se revalida la tarifa vinculada contra `costeo_tarifas_vigentes_v`. Severidades sin_cambios / informativa / bloqueante. Re-aprobación de ventas vía banner.
type: feature
---

## Flujo

```
Crear embarque → revalidar_tarifa_cotizacion(RPC)
  ├─ sin_cambios     → crear_embarque_borrador_desde_cotizacion(decision='sin_cambios')
  ├─ informativa     → RevalidarTarifaModal → operaciones elige
  │     ├─ Mantener  → decision='mantenida_por_operaciones'
  │     └─ Refrescar → decision='refrescada', tarifa_id_aplicada=vigente
  └─ bloqueante      → Modal → solicitar_reaprobacion_tarifa
                        └─ notificacion_interna a operador comercial
                          └─ ventas resuelve en ReaprobacionTarifaBanner
                            └─ resolver_reaprobacion_tarifa('reaprobada'|'rechazada')
                              └─ si reaprobada → decision='reaprobada_ventas'
```

## Reglas clave

- `cotizacion_costos` es inmutable después de Aceptada. NUNCA sobreescribir al refrescar.
- `conceptos_costo` del embarque SÍ se actualizan cuando decision='refrescada'.
- Precio al cliente intocable salvo decision='reaprobada_ventas'.
- Severidad bloqueante = tarifa vencida (si `tarifa_revalidacion_bloquea_si_vencida=true`) o cualquier delta_pct > umbral (default 5%).
- Recargo eliminado en tarifa vigente → siempre bloqueante (delta_pct=100).

## Configuración

`configuracion` categoría `operaciones`:
- `tarifa_revalidacion_umbral_pct` (default 5)
- `tarifa_revalidacion_bloquea_si_vencida` (default true)

Restricción única `(organization_id, categoria, clave)` desde 13.71.3 — un valor por org.

## Trazabilidad en `embarques`

- `tarifa_id_original` = la tarifa de la cotización al momento de revalidar.
- `tarifa_id_aplicada` = la que se usó (puede ser igual u otra vigente).
- `tarifa_delta_jsonb` = snapshot completo del delta detectado.
- `tarifa_decision` ∈ ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas').
- Expuestos en `EMBARQUE_DETAIL_COLUMNS` y consumidos por `OrigenCostosSection` (pestaña Resumen) y banner de `TabConciliacion`.

## Archivos

- Dominio puro: `src/lib/domain/revalidacionTarifa.ts`
- Servicio: `src/features/cotizacion/services/revalidacion/index.ts`
- Hooks: `src/features/cotizacion/hooks/useRevalidacionTarifa.ts`, `usePendientesReaprobacion.ts`, `embarques/hooks/useEmbarqueTarifaInfo.ts`
- UI cotización: `src/features/cotizacion/components/revalidacion/{RevalidarTarifaModal,ReaprobacionTarifaBanner,CrearEmbarqueConRevalidacion}.tsx`
- UI embarque: `src/features/embarques/components/OrigenCostosSection.tsx`
- Dashboards: KPI en `/operaciones`, banner comercial en `/dashboard`
- Lista cotizaciones: badge `⚠ Re-aprobación pendiente` cuando `estado_revalidacion='pendiente_reaprobacion'`

## Pendientes conocidos (no implementados)

- Emails automáticos al cliente cuando ventas re-aprueba o re-cotiza con cambio de precio (hoy sólo bitácora + notificación interna).
- Badge "Precio cambió" en tiempo real por fila (requiere RPC batch que compare snapshot vs tarifa vigente — el badge "Tarifa vencida" ya está, usa el JOIN de la lista).

## Cierre v13.73.0

- `resolver_reaprobacion_tarifa` acepta `'recotizada'` además de `reaprobada`/`rechazada`.
- `ReaprobacionTarifaBanner` ofrece 3 acciones: re-aprobar, **re-cotizar con tarifa vigente** (llama `recotizar_cotizacion` + navega a `/cotizaciones/:id/editar`), o rechazar. Al guardar y aceptar la nueva versión, el PDF se regenera por el flujo normal.
- `COTIZACION_LIST_COLUMNS` hace JOIN con `costeo_tarifas:tarifa_id(vigente_hasta)`; `estadoVigenciaCell` muestra badge `⚠ Tarifa vencida` cuando la cotización está Aceptada y la tarifa expiró.

## Fase 2 implementada

- Versionado de `cotizacion_costos` con `cotizacion_costos_historico` (ver mem://features/versionado-cotizaciones-reconciliacion).
- Reconciliación a 3 columnas Cotizado / Refrescado / Real con umbrales por organización.
