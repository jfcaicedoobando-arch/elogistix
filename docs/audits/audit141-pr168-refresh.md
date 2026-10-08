# AUD141: actualización conservadora de PR168 sobre el núcleo54

## Base y alcance de esta actualización

El candidato del 2026-10-08 conserva las 17 rutas propias de PR168 sobre el nuevo padre PR181 `9bdd95003b7837dbc8ab70d6f037985964828bf8`, árbol `ce890d38cb9b78833a4449c6074bbbcfa8e0f362`. Ese padre incorpora main `a9816f507ec006d378f358b9a4e2e453b7a10734`, versión `13.824.42`. La fuente de las 17 rutas es el head anterior de PR168 `d9a9dd5ccfd58882121a569629182d495b52df8b`, árbol `55ae8fbfed38be8b6f7e7f4dfef9a68aa7a77320`.

La composición compara árboles completos sin truncamiento. No sustituye archivos compartidos con copias antiguas: conserva todo el padre y aplica sólo el delta propio de PR168. Las 16 rutas funcionales, de tipos, SQL y pruebas conservan su propósito anterior; este documento es la única actualización editorial propia. No se altera la lógica monetaria ni el contenido de la migración2356.

## Delta funcional conservado

- Dos RPC: `cobranza_conteo_por_cobrar` y `cobranza_conteo_vencidas`, su transporte, tipos y la invalidación tras pagos/REP.
- Filtro monetario de `BandejaPorCobrar` y su regresión: la tabla y el contador excluyen el ruido0.0049/Sin saldo y conservan el centavo real.
- Saldo neto monetario, fecha de negocio de México, NC Timbrada/Aplicada y pagos activos. Una Pagada histórica sin pago activo sigue excluida. Ayer pertenece a Vencidas; hoy, futuro y sin fecha a Por cobrar.
- Ámbito de organización, restricciones anon y las dos suites SQL141 originales conservados.

El núcleo54 continúa siendo prerrequisito. Los dos RPC deben existir en backend antes de publicar el frontend que los consume. Esta actualización no importa Dirección ni incorpora el cierre54/139 de la composición posterior; tampoco retira dependencias o correcciones que ya están en el padre.

## Uniones verificables

- `src/integrations/supabase/types.ts` conserva byte por byte todos los tipos del padre/main42, incluidos `p_medio` y las firmas131. Sólo agrega las dos firmas RPC141.
- `supabase/schema/baseline.sql` conserva byte por byte el padre al retirar del candidato las dos funciones141 y sus seis líneas de permisos. No reemplaza ninguna función heredada.
- `supabase/tests/_guards_manifest.txt` conserva las 199 suites del padre y agrega únicamente las dos suites141: 201 entradas únicas y existentes.
- Las otras 13 rutas funcionales conservan exactamente los blobs del head anterior. El documento se revisa por separado.
- Versión42, manifiesto de migraciones, changelog, SQL histórico y todos los demás archivos del padre permanecen intactos. No se usa `--update` ni se asigna un release a2355/2356.

## Límite pendiente de AUD141

`20261007235600_audit141_cobranza_conteos.sql` sigue siendo la partición revisada de los dos contadores y sus grants. No incluye la corrección posterior `20261007235700_audit141_conteos_todas_monedas.sql`, destinada a los conteos de `cobranza_agregados` en todas las monedas. Por tanto, actualizar PR168 no demuestra el cierre global de141 y no autoriza marcarlo resuelto.

La entrega permanece draft. El guard `audit:manifest` debe seguir mostrando las migraciones2355/2356 pendientes de release; no se altera para ocultarlas. Sin SQL remoto, migraciones de datos, backfill, despliegue ni merge en esta fase. AUD54 global también continúa pendiente de su composición y verificación integradas.

## Evidencia

La validación nueva se registra sobre este candidato exacto. Los checks históricos del head anterior se mantienen como antecedentes y no se presentan como resultados de esta actualización. Véase también [la entrega del núcleo54](audit54-core-delivery.md).

Comprobaciones locales nuevas, 2026-10-08:

- Tipos completos app/node y lint focal: PASS.
- 120 tests en16 archivos del delta168 y del padre54: PASS, con un worker y heap3072MiB.
- Invariantes de las17 rutas, tipos, baseline, guards y conservación de versión/manifiesto42: PASS.
- `audit:migrations`, `audit:schema-functions` y `audit:replay-mirror`: PASS. Este último conserva dos divergencias preexistentes con su huella exacta.
- PostgreSQL17.9 desechable en loopback: replay de296 migraciones no consolidadas, candado service_role-only, cobertura RLS e integridad PASS;201/201 guards y50/50 suites RLS PASS. El reporte RPC-sync inspeccionó el catálogo local vivo y registró0 funciones sospechosas. El servidor se detuvo al terminar.
- El runtime rechazó la creación de sockets Unix; se utilizó PostgreSQL sóloTCP local, sin acceso a bases remotas. El primer arranque fallido no se cuenta como validación.
- `audit:manifest`: FAIL esperado y conservado, exclusivamente por2355/2356 sin release. No se ejecuta `--update`.
- No se presenta esta ejecución focal como CI completa. No se corrieron build, Deno ni GUI, ni comparación del dump completo contra la baseline con la imagen pinneada de CI.
