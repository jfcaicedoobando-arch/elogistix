# Registro de replay Drizzle 0021–0023

Los tres SQL ya estaban en `drizzle/migrations/` y su journal, pero faltaban en
`drizzle/replay.json` y en la historia canónica Supabase. El auditor reportaba
DR1 y DR4 para cada uno; tres suites de CI detectaban la misma ausencia.

Se agregan copias **byte por byte** en `supabase/migrations/`, en orden 0021,
0022, 0023, con los SHA-256 de los orígenes inmutables en el registro de replay.
No se modifican cuerpos, permisos, roles, journal ni migraciones anteriores.
El manifest de la versión actual se amplía sin podar las entradas históricas.
La prueba `drizzle-0021-0023-replay.test.ts` fija bytes, hashes, mappings y la
higiene de los tres replays; los tests globales siguen auditando toda la cadena.

Esto prepara la reconstrucción en pruebas, **no registra ni certifica aplicación
en ninguna base remota**. No ejecutar estos replays sobre una base que ya recibió
Drizzle sin reconciliar previamente su catálogo y registro de migraciones:
0022 contiene un `CREATE TRIGGER` histórico no repetible. El replay literal no
se convierte en un parche idempotente ni en autorización de despliegue.

## Snapshot y permisos del harness CI

El snapshot `supabase/schema/baseline.sql` es posterior al harness de pruebas,
que añade permisos generales a `authenticated` y `service_role`. No es evidencia
de ACL productivas. Para el trigger de 0022, una comprobación de catálogo exige
la ACL owner-only antes de esos grants; después se retiran únicamente los dos
grants artificiales y se vuelve a comprobar la ACL, incluidos permisos heredados.
No se modifica ningún permiso en las migraciones históricas ni en bases remotas.

Los tres archivos de `supabase/migrations/` son migraciones canónicas elegibles
para una futura ejecución, no fixtures exclusivos de tests. Este PR no autoriza
su aplicación externa; el estado de Lovable permanece sin verificar.

## Evidencia de reconstrucción aislada

El run RLS `40384475472` aplicó los tres replays en Postgres efímero y pasó
la guardia de integridad, pero detectó que el snapshot de esquema no contenía
sus objetos. El snapshot se actualiza con ese diff observado (sin datos).
La revisión detectó además que el GRANT masivo del harness de CI reabría el
trigger 0022: ahora se verifica su ACL owner-only antes del harness y después
de retirar exclusivamente los dos grants añadidos por el harness. No se
modifican las ACL de ninguna migración original ni de una base remota.

Los archivos en `supabase/migrations/` no son fixtures: son elegibles para una
futura aplicación de migraciones. El PR debe permanecer sin merge/publicación
hasta revisar esa integración; este trabajo no verifica automatismos externos
de Lovable ni autoriza aplicar SQL productivo. CI no prueba paridad con el
catálogo o el registro de migraciones de una base remota.
