# Release 13.824.44: nueva recomposición local revisada

## Identidad y alcance

Este candidato es una recomposición nueva para revisión sobre main `a9816f507ec006d378f358b9a4e2e453b7a10734`. La base 43 se construyó aplicando sus 13 rutas recuperadas con Git blobs históricos exactos; árbol completo verificado `ab7b7d76964c06e60f6dcec424088b2e4cfe318c`. No se presenta como un commit histórico recuperado, el árbol provisional `ec34a22145b684e7c780c2b24499fd56380c7035` ni el ZIP original perdido de 12 archivos.

Las seis fuentes archivadas de 44 se conservan byte a byte: migración 001700, espejo `cxp_por_pagar.sql`, suite SQL, fixture frontend y los dos planes históricos. Los planes contienen resultados y padres de composiciones anteriores, incluidos inventarios de 1.487 migraciones. Se mantienen como documentos de procedencia, no como evidencia ejecutada ni instrucciones de aplicación para esta recomposición.

## Cambio funcional conservado

`cxp_por_pagar()` obtiene `pagado` y `saldo` directamente de `v_proveedor_facturas_saldo`. Mantiene moneda documental, identidad de pagos, estados, filtros, fechas, orden y límite 500. La migración y su espejo tienen 1.669 bytes y SHA-256 `b7d5eab0c5e310a589cf04271b1650a789582493ff15884fe3ff707e14663a2e`. No se cambia el SQL archivado ni se añade lógica nueva de producto.

El baseline se recompone reemplazando sólo ese cuerpo con el de la migración, sin cambiar su cabecera ni ningún otro byte del dump. La migración incluye `REVOKE ALL` a PUBLIC/anon y `GRANT EXECUTE` a authenticated/service_role: comparar archivos no demuestra los privilegios efectivos de una base ni sustituye una revisión de catálogo. No se afirma que 43 esté instalado en ningún backend.

## Conservación

La versión es 13.824.44 y su nueva entrada del manifiesto corresponde exactamente a las 1.490 migraciones del árbol: las 1.489 de 43 más 001700. Se conservan las entradas 35–43 sin poda ni reescritura semántica. Todos los archivos fuera del delta 44 conservan los blobs y modos de la base 43. La base 43 conserva todas las rutas de main fuera de sus 13 rutas de alcance. Esto incluye los cambios concurrentes de pricing y los archivos ya existentes relativos a 144, que no se modifican.

El SQL y el baseline de Aging 43 se conservan. Este candidato no incorpora la release 45, otros splits posteriores, cambios PDF o envelopes de aplicación. La documentación, versión, manifiesto, guarda y nota técnica de 44 se redactaron o recompusieron para este candidato nuevo; no se atribuyen a una frontera histórica sin inventario.

## Verificación propia y límites

Se adjuntan a la entrega inventarios completos, delta 43 contra main, delta 44 contra 43, hashes y comprobaciones de conservación. Las comprobaciones estáticas/focales se registran en el informe de entrega con estado y comando exactos. Los resultados históricos citados en los planes no se reutilizan como pases actuales.

Este trabajo no ejecuta SQL, replay limpio, forward 43→44, suites SQL/RLS/CAS, pruebas de catálogo/ACL, GUI ni operaciones remotas. Estas validaciones siguen pendientes para certificar una aplicación. No hay publicación GitHub, merge, despliegue ni creación/congelación de un envelope 44; no se toca el envelope 45. La revisión de archivos y los tests frontend focales no equivalen a una certificación funcional completa ni a autorización de aplicación.
