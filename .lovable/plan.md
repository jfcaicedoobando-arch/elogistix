# Revisión de lectura previa a la aplicación H14 (collector acotado)

Sólo lectura. No se editó código, no se aplicó SQL, no se publicó.

## Resultados verificados

| Comprobación | Resultado |
|---|---|
| HEAD local | `3dbac2fc1737fb9583d58bdb0f508e5955127cd2` (#446), coincide con el SHA indicado |
| Base destino | `postgres` del proyecto Librecarga (Lovable Cloud) |
| Forward | `supabase/migrations/20261104020000_h14_diagnostico_baja_lectura_acotada.sql`, 216 líneas, SHA-256 `9a7c54759c63186421fa860d6ed2722f9cfd88c729edf6bd8a5f47f1f2a68ef7` |
| Firma del collector | 1 sola sobrecarga: `public._h14_dependencias_baja_embarque(uuid,uuid,boolean)` |
| `md5(prosrc)` actual | `2c3f605ce82bba1419c44c5650746f90` = **preimagen** (no es postimagen; la aplicación sí procede) |
| Propiedades | owner postgres, SECURITY INVOKER (`prosecdef=f`), VOLATILE, PARALLEL UNSAFE, cost 100, rows 0, 3 args, 1 default `false`, argnames `{p_embarque_id,p_org,p_ejemplos}`, `proconfig={search_path=public}` |
| ACL | `{postgres=X/postgres}`: privada, sólo postgres |
| Helpers que usa | `_h14_proformas_baja_embarque(uuid,uuid)`, `_h14_facturas_baja_embarque(uuid,uuid,uuid[])` existen |
| Funciones que lo llaman | `_h14_guard_baja_embarque`, `diagnosticar_baja_embarque`, `eliminar_embarque_completo`, `purgar_embarque_cascade` (no cambian; `CREATE OR REPLACE` conserva firma y ACL) |
| Actividad concurrente | Sin sesiones activas ajenas ni bloqueos exclusivos sobre `pg_proc` en el momento de la consulta |
| Drizzle local | Último registro `0024_h14_baja_embarque_integridad_financiera` (idx 24). No existe otro archivo pendiente |

Todos los criterios del preflight del propio SQL coinciden con lo observado, así que pasaría.

## Bloqueos y límites

1. **No pude leer el historial remoto**: `drizzle.__drizzle_migrations` y `supabase_migrations.schema_migrations` responden «permission denied» con el rol de lectura. No puedo confirmar desde ahí que no haya otra migración aplicada o en curso. La única evidencia es el estado del catálogo (preimagen intacta) y el journal local.
2. **La ventana sin otro DDL no se puede garantizar desde aquí**: la consulta muestra un instante. Como dice el doc (paso 2), hay que serializar los despliegues durante la aplicación.
3. Falta la convergencia de los tres jobs individuales que mencionaste: queda de tu lado.

## Procedimiento futuro (cuando lo autorices)

1. Volver a leer `md5(prosrc)` justo antes; si da `3aafb5cf…` no se aplica (ya sería postimagen); si no es ninguno de los dos hashes, detenerse.
2. Aplicar con la herramienta de migración, que gestiona la transacción ella misma. **Única adaptación**: quitar la línea 4 `BEGIN;` y la línea 216 `COMMIT;`. Ambos bloques DO (preflight y postflight), `CREATE OR REPLACE` y la lógica quedan byte a byte. Los `BEGIN` de las líneas 6, 43 y 191 son de PL/pgSQL y se quedan. Es la misma adaptación que se usó en 0024 (diff: sólo esas dos líneas).
3. Sin cambios de timeout, grants, triggers, datos ni secretos.
4. Postflight: el propio SQL exige el MD5 `3aafb5cf009c477e626357cb9ba78da8` y la ACL privada. Después se repiten las lecturas del catálogo de esta revisión.

## Archivos Drizzle que generará

- `drizzle/migrations/0025_<nombre>.sql` (por ejemplo `0025_h14_diagnostico_baja_lectura_acotada.sql`): el forward sin `BEGIN;`/`COMMIT;`
- `drizzle/migrations/meta/0025_snapshot.json`
- Nueva entrada idx 25 en `drizzle/migrations/meta/_journal.json`
- `src/integrations/supabase/types.ts`: la firma no cambia, así que el cambio esperado es nulo

## Registro en `drizzle/replay.json` (evitar DR1)

Causa de DR1 en 0024: el `sha256` debe ser el del **archivo Drizzle generado** (sin BEGIN/COMMIT, con LF), no el del forward de Supabase. El auditor (`scripts/lib/audit-drizzle-replay.ts`, `scanMapping`) exige una sola entrada con ese hash exacto, y DR2 exige que el replay exista en `supabase/migrations`. Entrada a añadir, siguiendo el patrón de la entrada 0024 (sin `scope`, porque el replay es la migración real de producción):

```text
{
  "file": "0025_<nombre>.sql",
  "sha256": "<sha256sum del archivo 0025 generado>",
  "replays": ["20261104020000_h14_diagnostico_baja_lectura_acotada.sql"]
}
```

El hash se calcula después de generar el archivo (no se puede saber antes). DR4 comparará cuerpos de función entre 0025 y el replay. Como sólo difieren el BEGIN/COMMIT de nivel superior, deberían coincidir. Esto es una expectativa: no lo ejecuté.

Validación local focalizada prevista tras aplicar: `audit:migrations` (DR1–DR6). El CI/RLS completo queda para GitHub Actions.

Espero tu mensaje para aplicar.
