# Diagnóstico de compactación (squash) de la base — sólo lectura

Objetivo: entregar un informe que diga si conviene compactar el historial de migraciones, qué costaría y qué riesgos tiene. No se modifica código, historial ni base.

## Pasos
1. Contar y medir el historial: archivos en `supabase/migrations/`, entradas del journal de `drizzle/`, copias en `scripts/ci/drizzle-history/`, tamaño total y de `supabase/schema/baseline.sql`.
2. Comparar con lo aplicado: leer `drizzle.__drizzle_migrations` y `supabase_migrations` (sólo SELECT) y usar `lov_database--migration_history inspect` para confirmar que no hay desfases.
3. Medir el costo actual: tiempo de reconstrucción limpia registrado en CI/local y qué guards dependen de hashes fijados (replay mirror, control.mjs, pruebas de historial aislado).
4. Revisar tamaño real de la base (`db_health`): disco, tablas más grandes, WAL, para separar "historial pesado" de "datos pesados".
5. Redactar informe en `/mnt/documents/diagnostico-squash.md` con: cifras, riesgos (producción ya registró cada migración, hashes inmutables, trazabilidad fiscal/auditoría), alternativas (baseline como punto de partida sólo para entornos nuevos, archivar migraciones antiguas sin borrarlas) y recomendación.

## Fuera de alcance
- Reescribir, borrar o renumerar migraciones.
- Ejecutar SQL de escritura, migraciones o suites completas de CI/RLS.
