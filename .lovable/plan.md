
# Auditoría del módulo "Auditoría Operativa"

## Diagnóstico actual

**Cómo está hoy** (`/auditoria`, `src/features/auditoria/`):

- 1 RPC `auditoria_embarques_org` que devuelve `ReporteAuditoria` con 12 reglas.
- 3 tabs: **Ejecutivo** (score, MTTR, ranking, fugas financieras), **Hallazgos** (tabla filtrable + revisión/snooze/asignación) y **Por regla**.
- Workflow de revisión completo: `auditoria_revisiones` + comentarios + snooze + asignación + bitácora + snapshots diarios + IA explicativa.
- Tablas: `auditoria_revisiones`, `auditoria_comentarios`, `auditoria_snapshots`.

**Reglas vigentes**: `docs_faltantes`, `docs_pendientes_avanzado`, `fechas`, `ventas_sin_facturar`, `margen_negativo`, `margen_bajo`, `venta_sin_costo`, `costo_sin_venta`, `proforma_vencida`, `proforma_borrador_abandonada`, `proforma_inconsistente`, `embarque_huerfano`.

## Brechas detectadas (lo que ya no encaja con los flujos nuevos)

### 1. Reglas que se quedaron cortas frente a módulos nuevos
Desde que se construyó este módulo se agregaron: **FacturAPI** (timbrado/REP), **Compras (CXP)**, **Garantías y Demoras automáticas**, **Tarifa-first**, **Tracking externo**, **CRM**. Ninguno está cubierto:

| Flujo nuevo | Hallazgo que falta |
|---|---|
| FacturAPI | Facturas creadas pero **sin timbrar** > N días; facturas **canceladas sin sustitución** (motivo 01); **REP pendiente** para PPD con pago registrado |
| Cobranza | Facturas **timbradas vencidas** (CXC > umbral) — hoy sólo se ve `ventas_sin_facturar` |
| CXP / Compras | `proveedor_facturas` en **"por capturar"** estancadas; **CFDI proveedor con error de parseo**; CXP **vencida sin pago programado** |
| Garantías / Demoras | **Garantía sin devolución** tras `fecha_descarga`; **demoras no cobradas al cliente** vs cobradas a naviera; **demoras sin condiciones contractuales** capturadas |
| Tarifa-first | Embarque **sin tarifa vinculada** (rompe la política `cotizacion-tarifa-first`) |
| Tracking externo | Embarque en tránsito con **tracking sin actualizar > N días**; webhook **fallido** |
| CRM | Oportunidades **ganadas sin cotización**; cotizaciones **aceptadas sin embarque** generado |
| Cierre | Checklist falla en `validar_cierre_embarque` pero el hallazgo no aparece hasta que el usuario intenta cerrar |

### 2. Reglas que duplican o entran en conflicto con candados nuevos
- `docs_pendientes_avanzado` y `docs_faltantes`: hoy también las valida `validar_cierre_embarque` y `candado-docs-avance-estado`. Hay **doble fuente de verdad** con `getDocsForMode` y el CTE `exigidos` de la RPC.
- `proforma_borrador_abandonada` y `proforma_inconsistente`: solapadas con el flujo nuevo donde una proforma "borrador" puede ser intencional antes del timbrado.
- `ventas_sin_facturar`: el módulo de facturación ahora reconcilia automáticamente vía `convertir_proformas_a_factura`; el backfill manual ya existe en `/admin/auditoria` pero la regla sigue generando falsos positivos en embarques previos a 04-2026.

### 3. Modelo de "Score" y "Riesgo financiero"
- Score es una suma ponderada plana — no distingue **gravedad económica** vs **higiene operativa**.
- `riesgoFinancieroMxn` depende del campo opcional `monto_mxn`; muchas reglas no lo emiten, así que la cifra subestima la fuga real. No considera **CXC vencida en moneda extranjera** (sin tipo de cambio del día).
- No hay alerta de **regresión** (score peor que hace 7 días) aunque ya guardamos snapshots.

### 4. Workflow de revisión
- Asignación funciona, pero **no notifica** al responsable (no usa `notificaciones_internas` ni email) — el responsable se entera al entrar al módulo.
- `fecha_limite` existe pero no genera **recordatorio** ni escalamiento al vencer.
- Snooze indefinido posible si el usuario elige fecha muy lejana — no hay tope ni motivo obligatorio para snoozes > 30 días.

### 5. Segmentación por audiencia
Hoy todo se muestra mezclado al admin/operador. Faltan vistas filtradas para:
- **Operaciones** (docs, fechas, embarque huérfano, tracking).
- **Finanzas** (margen, CXC, CXP, REP, demoras).
- **Comercial / CRM** (proformas, cotizaciones, oportunidades).
- **Cumplimiento fiscal** (CFDI, REP, NC).

### 6. Navegación / acción
- Las cards drillean a la tabla con filtro pre-aplicado, pero **no hay deep-link al campo problemático** dentro del embarque (ej. ir directo al tab Documentos o Costos del embarque X).
- "Por regla" tab es un listado plano sin agrupar por cliente/operador.

### 7. Permisos
- `42501` se silencia globalmente para que el badge del sidebar no truene; eso impide a operadores con sólo membresía ver **sus propios hallazgos** (los que tienen asignados). Hoy o ven todo o no ven nada.

## Plan de modernización (4 fases)

### Fase 1 — Limpieza y reconciliación (1 PR)
- Unificar matriz `getDocsForMode` ↔ CTE `exigidos` de la RPC: extraer a una sola fuente SQL invocada por ambos.
- Retirar/atenuar reglas redundantes: `docs_pendientes_avanzado` pasa a severidad **medio** porque ya hay candado de cierre; `proforma_borrador_abandonada` excluye borradores creados < 24 h.
- Filtro automático de `ventas_sin_facturar` para embarques con ETD < 2026-04-01 (modelo viejo) — ya no aparecen como hallazgo sin que el usuario corra el backfill.
- Actualizar memoria `auditoria-docs-faltantes-rules` con la nueva fuente única.

### Fase 2 — Reglas nuevas (1 PR por dominio)
Agregar al `enum` `ReglaAuditoria` y a la RPC:

**Fiscal**
- `factura_sin_timbrar` (> 48 h en estado `borrador`).
- `rep_pendiente` (factura PPD con `pago_registrado` y sin REP > 72 h).
- `factura_cancelada_sin_sustitucion` (cancelada motivo 01 sin folio nuevo).

**Cobranza / CXP**
- `cxc_vencida` (factura timbrada con días vencidos > umbral).
- `cxp_por_capturar_estancada` (`proveedor_facturas` en "por capturar" > umbral).
- `cxp_vencida`.

**Operativo**
- `garantia_sin_devolucion` (post `fecha_descarga` + N días).
- `demora_no_cobrada` (demora naviera registrada sin contraparte de venta).
- `embarque_sin_tarifa` (rompe tarifa-first).
- `tracking_desactualizado` (en tránsito sin update > N días).

**Comercial**
- `cotizacion_aceptada_sin_embarque`.

Cada regla aporta `monto_mxn` cuando aplica (convertir USD→MXN con `tipo_cambio_dof` del día).

### Fase 3 — Score, workflow y notificaciones (1 PR)
- Reescribir `calcularScore` para ponderar por **impacto económico (60 %)** + **higiene operativa (40 %)**.
- Detección de **regresión 7 días** comparando contra `auditoria_snapshots`; mostrar badge en `EjecutivoScoreCard`.
- Notificar al responsable en **asignación** y al **vencer fecha límite** vía `notificaciones_internas` + queue de email existente.
- Tope de snooze a 30 días salvo motivo justificado escrito.
- Permisos: nuevo RPC `auditoria_embarques_mios` para operadores con sólo membresía (devuelve únicamente hallazgos asignados a `auth.uid()`).

### Fase 4 — UX por audiencia y deep-links (1 PR)
- Sub-tabs en "Hallazgos": **Operaciones / Finanzas / Comercial / Cumplimiento** (filtros pre-cargados por dominio).
- Deep-link por regla: cada `HallazgoRow` lleva una acción "Resolver" que abre el embarque/factura en el tab/campo correcto (ej. `/embarques/:id?tab=documentos&doc=BL_HOUSE`).
- "Por regla" agrupada por **cliente** y **operador** para detectar patrones.
- Centro de comando del responsable: vista "Mis pendientes" con due-date y orden por urgencia.

## Detalles técnicos

- Toda nueva regla se agrega en: `src/features/auditoria/types/index.ts` (enum), `constants/auditoriaConfig.ts` (label/icon/orden), `domain/reglaLabels.ts`, RPC `auditoria_embarques_org` (CTE nuevo), y tests en `domain/__tests__`.
- Conversión MXN: usar `useTasaIVA`/utilidades de `financialUtils.ts` — nunca hardcodear tipo de cambio (memoria `dynamic-exchange-rates`).
- Cambios SQL en migraciones nuevas; no editar la migración original. `GRANT EXECUTE` al rol `authenticated` y filtrado por `organization_id` con `has_role`.
- Versionado: una bump por PR siguiendo `instructions/changelog-updates`.
- Cobertura: cada regla nueva ⇒ test puro en `domain/__tests__` + test de hook en `hooks/__tests__` (mantener umbral 38 %).

## Fuera de alcance (backlog)

- Auditoría cross-tenant (eso vive en `/admin/auditoria`, ya tiene placeholder).
- Reportes PDF/Excel programados — se evalúa después de Fase 4.
- Auditoría de seguridad/RLS automatizada — distinta a auditoría operativa.
