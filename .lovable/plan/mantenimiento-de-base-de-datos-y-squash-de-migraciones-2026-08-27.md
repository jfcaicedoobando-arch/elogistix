# Mantenimiento de Base de Datos y Squash de Migraciones

## Diagnóstico

- **1112 migraciones** en `supabase/migrations/` (~5.8 MB de SQL).
- Tamaño de datos, conexiones y salud del motor: el snapshot de métricas no pudo recuperarse en este turno (límite de tamaño del payload); no hay señales de saturación conocidas.
- Las migraciones son solo texto histórico: **pesan cero en el rendimiento diario de la base de datos**. Son como el historial de Git: borrar commits viejos no hace que el código corra más rápido.

## ¿Hacemos squash? Recomendación: NO (por ahora)

Un squash (colapsar las 1112 migraciones en un solo archivo de "estado inicial") rompería la maquinaria de CI que hoy te protege:

| Sistema | Riesgo al hacer squash |
|---|---|
| `migration-manifest.json` | Se regenera, pero pierde la cadena histórica verificable |
| Suites RLS (`supabase/tests/rls`) | Hacen replay de migraciones; un squash invalida `_ci_drift.sql` y `drift-anclas.txt` |
| `audit:replay-mirror` | Los ~68 espejos canónicos comparan contra "la migración de mayor timestamp que los define" |
| `audit:migrations` (H6) | Audita el historial archivo por archivo |

Además, el squash solo ayuda al **provisión de bases nuevas** (replay más rápido), y ustedes ya resolvieron eso con `supabase/schema/baseline.sql`.

## Mantenimiento que SÍ vale la pena

1. **Verificar salud real del motor** (reintentar `db_health` cuando el payload de métricas esté disponible, o revisar en el panel de Lovable Cloud: saturación de conexiones, tamaño de disco, deadlocks).
2. **VACUUM/ANALYZE**: Postgres lo hace automáticamente (autovacuum); no requiere acción manual salvo tablas con muchísimo churn. Se puede revisar `pg_stat_user_tables` para tablas con muchas filas muertas.
3. **Queries lentas**: correr `supabase--slow_queries` para detectar índices faltantes antes de que crezca el volumen.

## Plan propuesto

1. Correr diagnóstico de queries lentas y tablas con bloat (lectura, sin cambios).
2. Si aparece algo concreto (índice faltante, tabla inflada), remediarlo en una migración puntual.
3. **Posponer el squash** hasta que un replay en base limpia tarde más de ~2-3 minutos o supabase/CI lo exija; en ese momento hacerlo como proyecto dedicado con actualización de baseline, manifiesto, espejos y suites RLS.

## Detalles técnicos

- Sin cambios de esquema en este plan: solo consultas de diagnóstico (`read_query`, `slow_queries`).
- Cualquier índice nuevo se entregaría como migración normal con GRANTs/políticas intactos y sincronización de `baseline.sql` + manifiesto, siguiendo el flujo habitual.
