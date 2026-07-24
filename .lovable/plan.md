
# Auditoría de CPU — Lovable Cloud

## Diagnóstico (verificado con `db_health` + `slow_queries` + `pg_stat_user_tables`)

**El backend está sano estructuralmente** (memoria 46%, disco 16%, conexiones 16/60). El CPU se va en **volumen de llamadas repetidas** y **transacciones que se abortan**, no en datos pesados.

Analogía: la base de datos no está llena, pero suena el timbre miles de veces por minuto — cada timbrazo es barato, sumados agotan al portero.

### 🔥 Top consumidores (últimos 7 días, tiempo total CPU)

| # | Consulta | Llamadas | Tiempo total | Problema |
|---|---|---:|---:|---|
| 1 | `auditoria_revisiones` list (created_at DESC) | 5 164 | 190 s | Volumen + falta índice `created_at` |
| 2 | `conceptos_costo` con LATERAL join a `embarques` | 916 | 155 s | LATERAL con `LIMIT 1` innecesario |
| 3 | RPC `sidebar_alert_counts()` | **9 369** (3 589 + 5 780) | 218 s | Se llama en cada montaje del layout |
| 4 | `conceptos_venta` por embarque_id ANY() | 1 778 | 106 s | Sin índice compuesto óptimo |
| 5 | `bitacora_actividad` (accion <>) | 135 | 78 s | Sin índice sobre `accion` |
| 6 | `facturas` con LATERAL a pagos + NC | 2 097 | 74 s | LATERAL costoso, sin `organization_id` en WHERE |
| 7 | RPC `operadores_distintos()` | 1 885 | 68 s | Se llama demasiado, sin cache |
| 8 | `auditoria_revisiones` (segunda variante) | 2 382 | 57 s | Mismo problema #1 |
| 9 | RPC `cartera_pendiente()` | 125 | 41 s | Cara individualmente (330 ms media) |

### 🚨 Bandera roja adicional
- **82 323 240 transacciones abortadas** desde el último boot. Esto significa que algún endpoint lanza excepciones sin parar (probablemente RLS o `RAISE EXCEPTION` en trigger). Cada rollback consume CPU aunque no persista datos.

## Plan de remediación

### Fase 1 — Reducir volumen de llamadas (mayor impacto, menor riesgo)

1. **`sidebar_alert_counts` + `adminPendientes` — deduplicar montajes.**
   - `useSidebarAlerts` ya tiene `staleTime: 5 min`, pero se dispara ~9 000 veces. Investigar si el hook se monta en múltiples subárboles (sidebar + header + comandos), o si hay `queryKey` con dependencias inestables.
   - Acción: consolidar en un provider único a nivel `AppLayout` (`useSidebarAlerts` una sola instancia) y añadir `refetchOnWindowFocus: false` + `refetchOnMount: false`.

2. **`operadores_distintos()` — cachear más agresivo.**
   - Este RPC devuelve una lista casi estática (usuarios). Elevar `staleTime` a 15 min y `refetchOnMount: 'always' → false`.

3. **`auditoria_revisiones` (dashboard admin) — throttle.**
   - Verificar si algún componente lo consulta en cada render del panel `/auditoria`. Añadir `staleTime: 60 s` mínimo si no lo tiene.

### Fase 2 — Índices faltantes (migración SQL)

```sql
-- Ordenamientos frecuentes por created_at DESC
CREATE INDEX IF NOT EXISTS idx_auditoria_revisiones_created_at
  ON public.auditoria_revisiones (created_at DESC);

-- bitacora_actividad — filtro por accion <> ... ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bitacora_accion_created_at
  ON public.bitacora_actividad (accion, created_at DESC);

-- conceptos_venta — filtro común deleted_at IS NULL + embarque_id ANY()
CREATE INDEX IF NOT EXISTS idx_conceptos_venta_embarque_activo
  ON public.conceptos_venta (embarque_id)
  WHERE deleted_at IS NULL;

-- facturas — dashboard "por vencer"
CREATE INDEX IF NOT EXISTS idx_facturas_org_estado_vencimiento
  ON public.facturas (organization_id, estado, fecha_vencimiento)
  WHERE deleted_at IS NULL;
```

Antes de crear cada índice: correr `EXPLAIN (ANALYZE, BUFFERS)` para confirmar Seq Scan; después, re-EXPLAIN para verificar uso del índice.

### Fase 3 — Investigar rollbacks masivos (82M)

- Revisar `edge_function_logs` y logs de Postgres buscando `RAISE EXCEPTION` frecuente o errores `LC_*`.
- Sospechosos probables: triggers de coherencia CxP/proformas, RLS de tablas expuestas al portal cliente, o un cron/webhook que reintenta ciegamente.
- Acción: agregar consulta a `pg_stat_database.xact_rollback` en dos momentos separados para medir la tasa real, luego revisar Sentry por errores server-side con alto volumen.

### Fase 4 — Optimización de LATERAL joins (opcional, tras Fase 1-3)

- Reescribir queries auto-generadas por PostgREST que usan LATERAL con `LIMIT 1 OFFSET 0` — normalmente vienen de embeds `select('*, relacion(campo)')` que podrían resolverse con RPC + join plano.
- Target: `conceptos_costo → embarques` y `facturas → pagos_factura + factura_notas_credito`.

## Detalles técnicos

- Ninguna operación bloquea la app; todas se pueden aplicar incrementalmente.
- Los índices en tablas <10k filas no son urgentes, pero eliminan Seq Scan que multiplicado por miles de llamadas suma CPU.
- **No** se recomienda todavía `resize_compute`: la saturación no viene de RAM/conexiones sino de patrón de acceso. Primero optimizar, luego reevaluar `db_health`.

## Entregable

Un solo release `v13.312.23` con:
1. Consolidación de hooks de sidebar y cachés (Fase 1).
2. Migración SQL con los 4 índices (Fase 2).
3. Reporte de rollbacks + issue de seguimiento si se identifica trigger culpable (Fase 3).
4. Fase 4 se pospone a un segundo release si tras aplicar 1-3 el CPU sigue alto.
