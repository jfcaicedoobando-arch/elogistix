# Plan: ¿Squash/rollup de migraciones SQL?

## Respuesta corta

**No es necesario en este momento.** Con 817 migraciones (3.8 MB) y la historia ya aplicada en producción/previews, el riesgo de un squash clásico supera a la ganancia. El pipeline actual ya mitiga el principal dolor (tiempo de CI) con el snapshot de RLS.

## Estado actual confirmado

- `supabase/migrations`: 817 archivos, 3.8 MB.
- Baseline de higiene: `20260810053328`.
- Migraciones pre-baseline: 797; post-baseline: 20.
- CI ya cachea un snapshot de PostgreSQL para evitar re-aplicar 800+ migraciones en cada PR.
- Las migraciones están aplicadas en producción/previews.

## Opciones evaluadas

| Opción | Riesgo | Ganancia | Recomendación |
|--------|--------|----------|---------------|
| **A. No hacer nada** | Mínimo | Ninguno, pero tampoco se introduce riesgo | **Recomendada ahora** |
| **B. Snapshot de schema para bases limpias** | Bajo | Reduce arranque de nuevos entornos y CI | Opcional si el tiempo de base limpia crece |
| **C. Rollup de archivos legacy** | Alto | Menor tamaño de repo | No recomendada con producción aplicada |

## Opción recomendada: A (no squash) + trigger de activación

Mantener el pipeline actual y vigilar dos métricas:

1. Número de migraciones > 1500.
2. Tiempo de aplicación de migraciones en base limpia > 10 minutos.

Si se cruza algún umbral, se implementa la **Opción B**.

## Plan técnico para la Opción B (listo por si se activa)

1. **Generar snapshot de schema**
   - Usar `pg_dump --schema-only --no-owner --format=plain` contra un entorno con el estado actual aplicado.
   - Guardar como `supabase/snapshots/schema_baseline.sql`.
   - Verificar que el dump preserve GRANTs y no use `--no-privileges`.

2. **Acelerar CI en base limpia**
   - En `rls-tests.yml`, permitir restaurar `schema_baseline.sql` y luego aplicar solo las migraciones posteriores a la fecha del snapshot.
   - Mantener un job de "drift" que, una vez por semana, aplique el snapshot + nuevas migraciones y compare contra la ejecución completa.

3. **Documentar y versionar**
   - Registrar el procedimiento en `docs/migrations-hygiene.md`.
   - Actualizar `APP_VERSION` y `CHANGELOG.md` si se activa.

## Riesgos de hacer un squash clásico (Opción C)

- `supabase_migrations` guarda nombres de archivo y hashes; renombrar o combinar archivos ya aplicados provoca drift o fallos en `supabase db push`.
- Requiere insertar manualmente registros de migración en producción/previews, con riesgo de dejar la base en un estado inconsistente.
- Invalida la trazabilidad de cambios recientes (ej. auditoría H6, baseline bumps).

## Conclusión

**No hacer squash ahora.** El sistema está sano y la optimización mayor ya existe. Si más adelante el crecimiento de migraciones ralentiza el arranque de entornos, se activa la Opción B (snapshot de schema) sin tocar el historial de producción.
