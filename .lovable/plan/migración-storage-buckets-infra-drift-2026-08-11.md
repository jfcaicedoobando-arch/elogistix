# Migración `storage_buckets_infra_drift`

## Objetivo
Registrar en el historial de migraciones los 4 buckets privados que hoy solo existen porque se crearon a mano (drift de infraestructura), más el guardarraíl que verifica que los 7 buckets requeridos existan.

## Qué se va a crear
Un único archivo nuevo: `supabase/migrations/<timestamp>_storage_buckets_infra_drift.sql`, con **exactamente** el SQL de las secciones 1 y 2 del archivo que subiste (upsert de `cotizaciones-pdf`, `facturas-pdf`, `cxp-inbox`, `agente-cartas-garantia` forzando `public = false`, + bloque `DO $$` que valida los 7 buckets). Sin cambios de una sola letra.

Se incluye también el bloque de comentarios de la nota P3 (índices) como documentación, ya que forma parte del archivo y no ejecuta nada.

## Estado real verificado (antes de escribir nada)
Consulté la base: los 7 buckets ya existen y los 7 están privados (`public = false`).

```text
agente-cartas-garantia  f
cotizaciones-pdf        f
cxp-inbox               f
documentos              f
facturas                f
facturas-pdf            f
reportes-feedback       f
```

Es decir: en producción la migración es un **no-op**. Su valor real es cerrar el drift para entornos nuevos y para la restauración del snapshot en CI (los tests RLS restauran el esquema y hoy dependen de `_ci_bootstrap.sql` para esos buckets).

## Detalles técnicos
- El archivo se escribe directamente en `supabase/migrations/` (no se ejecuta contra la base porque el estado ya coincide y la plataforma rechaza `INSERT INTO storage.buckets` a través del canal de migraciones). Queda como parte del historial y se aplicará en cualquier entorno nuevo.
- Timestamp por encima de la última migración existente (`20260819100100`) para no romper el orden ni el radar de drift (`drift-corte.env`).
- El SQL es idempotente: `ON CONFLICT (id) DO UPDATE SET public = false`, compatible con la regla H4 de migraciones.
- `FOREACH b IN ARRAY ...` es válido en PL/pgSQL, así que el guardarraíl compila sin ajustes.

## Bitácora
- Bump de `APP_VERSION` en `src/constants/appVersion.ts`.
- Entrada breve en `CHANGELOG.md` (raíz) con formato `## [X.Y.Z] - YYYY-MM-DD`.
