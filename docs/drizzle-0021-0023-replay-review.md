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
