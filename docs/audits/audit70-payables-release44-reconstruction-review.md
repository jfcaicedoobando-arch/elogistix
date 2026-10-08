# Release 13.824.44: reconciliación local con main

## Identidad y alcance

La fuente es PR195, head `93c71190d86ebc15ff9a29509ae70dcef17a2844`, árbol `b02b7bae5cd68e4fc643a3c0e0811d804299a5d5`. La base destino es main `60afa1919a5709d690458a2a8979199da4f3b6e3`, árbol `2b2986d171527f252c9f5c2d4d3aa74e21d7f454`. Release 44 no se ha fusionado ni aplicado. Esta reconciliación es local y no afirma publicación, aplicación ni una nueva release 45.

La comparación usa todos los archivos, modos y blobs de los árboles completos. Los únicos caminos modificados por ambos lados desde el árbol común `83be11c6453040934a5a32401ea57c461afc4237` son `AGENTS.md` y `supabase/schema/baseline.sql`. Se parte siempre de main. En la nota técnica se añade sólo Por pagar; en el baseline se reemplaza sólo el cuerpo de `cxp_por_pagar`, conservando su cabecera y el resto del archivo byte a byte.

## Fuentes y preservación

Se conservan byte a byte las seis fuentes revisadas de PR195: migración 001700, espejo `cxp_por_pagar.sql`, suite SQL, fixture frontend y dos documentos históricos de procedencia. La migración y espejo tienen 1669 bytes y SHA-256 `b7d5eab0c5e310a589cf04271b1650a789582493ff15884fe3ff707e14663a2e`. No se añade lógica funcional ni se modifica la lógica de 144/148.

Los planes históricos citan otras composiciones y resultados. Su conservación demuestra procedencia, no certifica esta reconciliación ni autoriza ejecutar sus pasos. Los resultados locales actuales y sus comandos quedan registrados en el paquete de revisión separado.

Todos los archivos actuales de main fuera de las 13 rutas de release 44 mantienen exactamente blobs y modos. En particular se conservan migraciones/replays 144/148, snapshots, journal, tipos, UI, fuentes ajenas, documentación y cambios concurrentes. La nota de seguros de `AGENTS.md` se conserva literalmente. El baseline mantiene todos sus bloques ajenos, incluida la implementación concurrente de main, sin investigar, reconstruir ni corregir sus reglas.

## Versión y manifiesto

`APP_VERSION` queda en `13.824.44`. Se conservan sin poda todas las entradas 35–43 del manifiesto y se añade la nueva entrada 44 con exactamente las 1492 migraciones del árbol: las 1489 de 43, los dos replays existentes de main y 001700 de Por pagar. Enumerar estos archivos no acredita que se hayan aplicado ni los vuelve a ejecutar. No se usa el actualizador que poda versiones históricas.

## Dependencia de integración

`drizzle/replay.json` conserva exactamente el blob de main. El mapping de los dos replays existentes lo atiende PR196 por separado; no forma parte de este delta 44. La integración debe conservar ese arreglo y los cambios de PR196 sin sobreescribirlos. Una eventual composición temporal de pruebas se identifica con su propio árbol; no equivale a que main o la rama 44 ya la contengan.

## Verificación y siguientes condiciones

Se adjuntan inventarios completos, comparación de conflictos, patch reproducible, árbol candidato y pruebas estáticas/frontend locales con sus estados reales. Los invariantes comprueban las seis fuentes idénticas, el manifiesto exacto, la historia intacta, los archivos concurrentes conservados y el baseline cambiado exclusivamente en Por pagar.

No se ejecutan migraciones ni SQL, incluyendo SQL 144, replay limpio, forward, suites RLS/CAS o verificación de catálogo/ACL. Tampoco GUI, despliegue, Git remoto ni preparación de envelopes. Las pruebas anteriores no se presentan como resultados actuales. Antes de cualquier publicación se necesita revisión independiente del árbol reconciliado, comprobar de nuevo el head de main y el de PR195, incorporar la dependencia de PR196 y validar los checks del commit exacto resultante. Cualquier aplicación de backend es una fase distinta y queda fuera de este paquete local.
