# `supabase/releases/` — Manifests de release

Este directorio guarda artefactos que relacionan versiones de la aplicación con el
estado del repositorio en ese momento.

- `migration-manifest.json`: lista ordenada de migraciones SQL que conforman
cada `APP_VERSION`. Se regenera con `bun run db:release-manifest:update`.

Revisado el 2026-09-26. El manifiesto no aplica migraciones ni certifica Live.
No regenerarlo ni cambiar APP_VERSION por una limpieza sólo documental.
