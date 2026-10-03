# Diagnóstico de capacidades (solo lectura, ya ejecutado)

Consulta operativa de diagnóstico. No se cambió código, dependencias, migraciones, datos, versión, secretos ni se publicó nada. Versión sigue 13.824.14.

## Resultados verificados

### 1. Conciliación del historial de migraciones (versiones 20261003010000 / 20261003011000 / 20261003022500)

- El CLI oficial de Lovable en este entorno **no tiene** comandos de migraciones ni repair (catálogo completo revisado).
- El CLI de Supabase **no está instalado** en el sandbox y Lovable Cloud no expone credenciales de base de datos para autenticarlo.
- La herramienta de migraciones del agente solo crea versiones nuevas con timestamp propio (descartada).

**Conclusión: no dispongo de flujo oficial para marcar esas 3 versiones como aplicadas.**

Acción oficial que le corresponde al admin fuera de este entorno (pipeline de GitHub Actions o máquina con CLI autenticado):

```text
supabase migration repair --status applied 20261003010000 20261003011000 20261003022500
```

Solo marca el historial; no ejecuta SQL ni crea versiones nuevas. El replay 2 (CRM hygiene) queda pendiente de la corrección forward que el usuario prepara en Git.

### 2. Sourcemaps de Sentry en el build publicado

- Documentación oficial confirmada: los build secrets (p. ej. SENTRY_AUTH_TOKEN) son **exclusivos del plan Enterprise**.
- En plan Pro no hay forma oficial de inyectar secretos ni pasos personalizados al build de publicación de Lovable.
- Compilar aparte no garantiza coincidir con los bundles reales publicados.

**Conclusión: es una limitación del plan Pro, no un bug del ERP.** La guarda `scripts/check-sourcemaps.sh` ya evita servir maps públicos; la subida a Sentry simplemente no ocurre en este plan.

## Sin acciones pendientes de mi lado

Todo lo anterior son acciones del admin fuera de Lovable o limitaciones de plataforma. No hay nada que implementar en el proyecto.
