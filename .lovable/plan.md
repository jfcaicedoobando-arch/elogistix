# Transacciones revertidas: diagnóstico y seguimiento

## Qué encontré

El contador de 363,659,795 "transacciones revertidas" **no es un síntoma de error**. La etiqueta "desde el último reinicio" es engañosa: los contadores de la base nunca se han reiniciado (`stats_reset` vacío) y las estadísticas de consultas acumulan **desde el 22/04/2026**, no desde el arranque de hoy.

Evidencia recolectada (sólo lecturas):

- La consulta con más llamadas es la que el API de datos ejecuta **antes de cada petición** (`set_config(... 'request.jwt.claims' ...)`), con 363,159,675 llamadas — coincide 1:1 con el número de reversiones.
- El API de datos abre una transacción por petición y, cuando la petición es **sólo de lectura, la cierra con un rollback** en lugar de un commit. Es su comportamiento normal.
- Proporción coherente: 13.1 M commits (escrituras) vs 363 M rollbacks (lecturas) en ~108 días ≈ 39 lecturas/segundo promedio.
- Medición en vivo de 20 segundos: **+0 reversiones**, +59 commits. El contador no está creciendo ahora mismo.
- Salud actual: memoria 46%, disco 17%, conexiones 14/60, 0 reinicios. Sin presión.

Analogía: es como el odómetro de un coche. Marca 363 mil km desde que salió de la fábrica, no desde que lo encendiste esta mañana — y girar el volante no rompe nada.

## Conclusión

No hay bug que arreglar ni riesgo de integridad. **No propongo cambios de código por esta métrica.**

Sí hay un tema secundario real, distinto: el volumen de lecturas repetidas. Las consultas más caras acumuladas son `sidebar_alert_counts()` (11,475 llamadas, 295 s totales) y el listado de `auditoria_revisiones` (6,965 llamadas, 255 s). Eso sí se puede bajar.

## Plan propuesto (opcional, bajo impacto)

1. **Dejar el contador de reversiones fuera del tablero de alarmas.** Documentar en `docs/sentry-runbook.md` (sección de salud de base) que reversiones altas = lecturas del API, y que la señal a vigilar es memoria, conexiones, deadlocks y consultas lentas.
2. **Reducir la repetición de lecturas caras:**
   - Revisar `useSidebarAlerts.ts`: hoy tiene `staleTime` de 30 min, pero 11,475 llamadas indican refetch por remontaje/foco. Añadir `refetchOnWindowFocus: false` y `gcTime` alineado.
   - Revisar el hook del listado de auditoría para que use el `staleTime` estándar del proyecto y paginación en servidor (ya existe el patrón).
3. **Vigilar deadlocks (8 acumulados).** Volver a medir en unos días; si crecen, ahí sí investigo la contención (probablemente disparadores de facturas/conceptos).
4. Registrar el hallazgo en `CHANGELOG.md` con bump de `APP_VERSION` sólo si se aplican los ajustes del punto 2.

## Detalles técnicos

- Fuente de los contadores: `pg_stat_database` (sin reset) y `extensions.pg_stat_statements` (reset 2026-04-22).
- El statement de 363 M llamadas es el pre-request de PostgREST; promedio 0.020 ms, total 7,328 s en 108 días (≈0.08% de un núcleo). No es un consumidor de CPU relevante.
- No se requieren migraciones ni cambios en RLS para este hallazgo.
