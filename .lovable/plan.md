# Remediación auditoría v14 — 40 hallazgos, en olas verificadas

Alcance aprobado: los 40 hallazgos (2 críticos, 11 altos, 17 medios, 21 bajos).
Regla de trabajo: **verificar antes de corregir**. Cada ola arranca leyendo el código/RPC citado y descartando falsos positivos; los descartados se reportan con la evidencia, no se tocan.
C-1 se corrige **solo hacia adelante** (sin backfill de embarques ya creados).

## Ola 0 — Verificación (sin cambios de código)
Contrastar los 40 hallazgos contra el código y la base actual, y entregar una tabla:
`ID | Confirmado / Ya corregido / Falso positivo / Decisión de producto | evidencia`.
Los marcados "NO PROBADO" por el auditor (A-5, A-7, M-9, M-12, M-15, B-1, B-4, B-6, B-8, B-11) se confirman con lectura de definición vigente en base, no solo del archivo de migración.
Salida: `docs/auditoria/remediacion-v14.md`. Sirve de checklist del resto de las olas.

## Ola 1 — Críticos
- **C-1 Doble IVA cotización → embarque.** `_crear_embarque_replicar_conceptos` deja de confiar en el `total` del JSONB: deriva `total = ROUND(cantidad × precio_unitario, 2)` y nunca reescribe el unitario. Además el wizard de cotización deja de persistir `total` con IVA (el IVA se sigue calculando en proforma/factura). Sin backfill.
- **C-2 Cron de snapshots.** El guard de `auditoria_capturar_snapshot` acepta `auth.role() = 'service_role'`, igual que `saldo_factura`. Se corrige junto con **A-10** (calcular contadores vía `auditoria_embarques_org(p_organization_id)` en lugar de depender de la org del caller) y **M-6** (pendientes reales, `por_regla` poblado, score con la misma fórmula que el score vivo).

## Ola 2 — Multi-tenant / impersonación
- **A-2** `cobranza_agregados`, `dashboard_facturacion_kpis`, `direccion_totales`: aceptan `p_organization_id` y usan `org_scope()`, patrón `libro_pagos`; los servicios pasan la org efectiva.
- **M-5** sobrecarga con org en `eerr_resumen_anual`; `busqueda_global` y `sidebar_alert_counts` dejan de mezclar orgs para super admin.
- **A-9 / M-4** los 4 listados globales de Compras reciben y aplican `organizationId`, con filtro y búsqueda server-side + `assertNotTruncated`.
- **A-4** EERR devengado resuelve embarques por org + `deleted_at` (o por `embarque_id`).
- **M-9** el estado de cuenta del portal deriva scope desde `current_user_client_ids()` para el rol cliente.

## Ola 3 — Soft-delete y estados en reportes
- **A-3** EERR mensual y dashboard ejecutivo filtran `deleted_at`.
- **A-8** presupuesto vs real y flujo proyectado excluyen liquidaciones `Cancelada`.
- **M-3** reporte de Compras: bucket EUR propio con su TC, excluye canceladas, y se documenta subtotal vs total.
- **M-16, M-17, B-13, B-14, B-15, B-16** filtros `deleted_at` faltantes (embarques del cliente 360, sugerencias CxP, lineage CRM, seguros, movimientos de cuenta, defaults de facturación).
- **M-10** nueva regla de auditoría `totales_descuadrados` (embarque vs suma de contenedores).

## Ola 4 — Integridad financiera y concurrencia
- **A-1** `consolidar_proformas`: sin `::int` en cantidades, IVA por línea con la tasa del concepto, encabezado = suma del detalle regenerado.
- **A-5** `FOR UPDATE` en el trigger de sobrepago CxP, espejo de CxC.
- **A-11** el validador de límite de crédito reusa el cálculo canónico de conceptos (incluye 8% frontera).
- **M-1** reabrir embarque limpia `cerrado_snapshot`, `pnl_base` y `calculo_snapshot`.
- **M-2** cobro cruzado a facturas EUR con paridad DOF del día del pago.
- **M-8** las reglas de auditoría exigen `tc > 1`, igual que el P&L.
- **M-14** banda de plausibilidad de TC (5–40 MXN/USD) en zod y CHECK.
- **M-11** creación de embarque + contenedores atómica dentro del RPC.

## Ola 5 — UX y fricción
- **A-6** diálogo de pago CxP con `initializedForRef`, para que un refetch no pise la captura.
- **A-7** importación de tesorería con chunking de 500 en select/insert, hash en lotes sin congelar la UI, y mensaje claro al topar el límite.
- **M-13** borrador/autosave del wizard de embarque, reusando el patrón de cotización.
- **M-12** aviso de modificación externa en el borrador de cotización (`tabId`).
- **M-7** las revisiones de auditoría dejan de filtrarse por 90 días.
- **M-15** se documenta el límite de crédito como fail-open by-design, sin cambio funcional salvo que la Ola 0 diga lo contrario.

## Ola 6 — Bajos (endurecimiento)
B-1, B-5, B-7, B-9, B-10, B-12, B-17, B-18, B-19, B-20 se corrigen tal como propone la auditoría (guardas de papelera, redondeo por línea, fechas locales en CSV, índices únicos parciales, validación de RFC, revalidación en servicio).
B-2, B-3, B-4, B-6, B-11, B-21 son decisiones de producto o gaps de alcance: se documentan en `docs/auditoria/remediacion-v14.md` para tu confirmación, sin cambio de comportamiento.

## Notas técnicas
- Cada ola con cambio de base cierra con `bun run db:postcheck` verde y baseline regenerada en el mismo cambio, más los guards SQL correspondientes (`supabase/tests/`).
- Las decisiones congeladas nuevas (banda de TC, roles, tolerancias) se declaran en `supabase/tests/_decisiones_negocio.sql`.
- Cada ola agrega tests: unitarios de dominio para cálculo/redondeo, `*.organizationFilter.test.ts` para los servicios con org, y guards SQL para RPCs y triggers.
- Cada ola bumpea `APP_VERSION` y registra su entrada en `CHANGELOG.md`.
- Sin tocar montos históricos: no hay UPDATE masivo de datos en ninguna ola.

## Entrega
Un mensaje por ola, con lo verificado, lo corregido, lo descartado y el resultado de tests/postcheck. Al terminar cada ola te digo si algo quedó pendiente antes de seguir.
