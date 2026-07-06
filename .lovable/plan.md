# Estado del roadmap fiscal — qué queda pendiente

Revisé `CHANGELOG.md` (13.186.0 → 13.187.3), migraciones y edge functions. Este es el corte al día de hoy.

## Ola 1 — Blindaje fiscal ✅ COMPLETA

| # | Item | Estado | Evidencia |
|---|------|--------|-----------|
| 1 | Guardar acuse SAT de cancelación | ✅ Hecho | Columnas `facturas.acuse_cancelacion_xml/_fecha/_status` + descarga en `facturapi-cancelar` (13.186.0) |
| 2 | Catálogos SAT completos (usos CFDI + formas de pago) | ✅ Hecho | `catalogosSAT.ts`: 25 usos, 22 formas de pago (13.186.0) |
| 3 | Verificación UUID CFDI vs SAT en factura de proveedor | ✅ Hecho | Edge `verificar-uuid-sat` + columnas `proveedor_facturas.uuid_verificado/_fecha/_estatus_sat` + botón en `InfoFacturaSection` (13.187.0 / 13.187.2) |
| 4 | Reintento automático nocturno de REP fallidos | ✅ Hecho | Edge `rep-retry-nocturno` con `pg_cron` a las 12:00 UTC + alertas en `alertas_sistema` (13.187.0). Nota: crea alertas, no re-timbra automáticamente. |
| 5 | Sustituir `MAN-{timestamp}` | ✅ Hecho | Prefijo cambiado a `BORRADOR-{timestamp}`, UI muestra "Sin folio (borrador)", envío/PDF/XML bloqueados hasta timbrar (13.186.0) |

## Ola 2 — Cierre de flujo operativo ⏳ PENDIENTE (0/4)

| # | Item | Estado |
|---|------|--------|
| 1 | Auto-liquidación: trigger que actualice `conceptos_costo.estado_liquidacion` al registrar pago de proveedor | ⏳ Pendiente. Existe util derivada `estadoLiquidacionDerivado.ts` pero no hay trigger BD ni escritura persistente. |
| 2 | Programación de pagos: campo `fecha_programada_pago`, bandejas "por programar" / "por ejecutar", proyección semanal | ⏳ Pendiente. Columna no existe en `proveedor_facturas`. |
| 3 | Estado de conciliación bancaria en detalle de factura proveedor (join con `bbva_movimientos`) | ⏳ Pendiente. Tabla existe pero no está referenciada desde `InfoFacturaSection`. |
| 4 | Cancelación de factura de proveedor con lógica (valida saldo, revierte NC, marca embarque) | ⏳ Pendiente. |

## Ola 3 — Fiscal avanzado ⏳ PENDIENTE (0/5)

| # | Item | Estado |
|---|------|--------|
| 1 | Retenciones ISR/IVA en `registrarPagoProveedor` (nueva tabla `retenciones_pago`) | ⏳ Pendiente. Tabla no existe. |
| 2 | Módulo DIOT: generación mensual + export TXT/XML SAT | ⏳ Pendiente. |
| 3 | Complemento de pago recibido: carga XML, vincula a `pagos_proveedor`, valida vs SAT | ⏳ Pendiente. |
| 4 | Aging de saldos CxC + reporte de antigüedad | ⏳ Pendiente. Existen buckets en `useFinanceDashboard.ts` pero no hay reporte formal ni PDF dedicado. |
| 5 | Respaldo automático de XML de facturas emitidas al bucket `facturas` | ⏳ Pendiente. Actualmente sólo se conserva en FacturApi + `facturas.acuse_cancelacion_xml` para cancelaciones. |

## Recomendación de próximo paso

Ola 2 tiene mejor ROI operativo inmediato (cierra los ciclos de tesorería / cuentas por pagar que ya están en producción). Sugiero arrancar por **Ola 2 · Item 1 (auto-liquidación)** porque:

- Ya existe la lógica derivada (`estadoLiquidacionDerivado.ts`) → sólo hay que persistirla con un trigger.
- Desbloquea los KPIs de "% conceptos liquidados" por embarque sin cálculos en runtime.
- Es cambio pequeño y aislado (trigger + backfill + refresco de query keys).

## ¿Con qué avanzo?

Opciones:
1. **Ola 2 completa** en 2 iteraciones (items 1-2 primero, luego 3-4).
2. **Sólo Ola 2 · Item 1** (auto-liquidación) como quick win.
3. **Saltar a Ola 3 · Item 5** (respaldo XML) si te preocupa más la contingencia fiscal que el flujo operativo.
4. Otra combinación que definas.

Dime cuál eliges y armo el plan de implementación detallado.
