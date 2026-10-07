# AUD141: actualización segregada de PR168

## Propósito y base

Sustituye el contenido obsoleto de PR168, anteriormente basado en release34, con los contadores actuales revisados sobre el núcleo54 `9fc2bc52153169b0c27396bc79725cb1a1d569e9` y main37 `57969acc4f89f7408fa6dc38bd769931f00cfe2d`. La base local equivalente `87d3f41` se comprobó contra todos los hashes del delta remoto. El traslado conserva exactamente la lógica54/141 revisada en `9f93e64`. PR168 se mantiene como la única entrega de141; no se abre un PR duplicado ni se conserva el envelope34.

Incluye sólo los RPC `cobranza_conteo_por_cobrar` y `cobranza_conteo_vencidas`, su transporte/tipos, invalidación tras pagos/REP y pruebas. Incluye el filtro monetario y su regresión en BandejaPorCobrar, necesarios para que la tabla y su contador descarten por igual el ruido0.0049/Sin saldo. Ambos usan el saldo neto monetario, el día de negocio de México, NC Timbrada/Aplicada y pagos activos; una Pagada histórica sin pago activo sigue excluida. Ayer pertenece a Vencidas; hoy/futuro/sin fecha pertenecen a Por cobrar. El ámbito de organización y las restricciones anon se conservan.

## Partición verificable

Los cuerpos de los dos RPC y sus grants son exactamente los revisados en el SQL mixto `20261007235600_audit54_collection_consumers.sql` del snapshot `2db2161bf6e41ffd64412c685dfb5eb13f4dc4c9`. Ahora se entregan solos en `20261007235600_audit141_cobranza_conteos.sql`. El ID es provisional, sin release asignado. Tipos y baseline agregan exclusivamente esos dos RPC.

No se importa `validar_cierre_embarque`, código Dirección, ni la cadena135→131→134→139. Dirección conserva su arreglo Decimal y el cierre54/139 en el candidato compuesto revisado, para una entrega separada que mantenga todas sus dependencias. El núcleo54 es prerrequisito de estos contadores: no se publica frontend antes de que estén aplicados ambos RPC.

La prueba complementaria extrae los fixtures revisados de pagos documentados, Pagada legacy, ayer/hoy/mañana, fronteras0.0049/0.005/0.01 y tenant; elimina únicamente las verificaciones de cierre139 y verifica pertenencia al listado monetario. Las pruebas de integración141 originales se mantienen byte por byte.

## Estado de entrega

Manifests publicados33–37, SQL histórico, Drizzle y versiones permanecen intactos. `audit:manifest` sigue pendiente/no pasado hasta un envelope futuro; no se evita el guard. Sin SQL remoto, migraciones de datos, backfill, despliegue ni merge. La validación de la partición y el estado de CI se anotan en PR168. Los checks históricos del candidato completo no se presentan como una nueva ejecución sobre este árbol. La parte estática de audit:rpc-sync pasó; el catálogo vivo no se consultó con éxito después de detener el PostgreSQL local y no se afirma PASS de esa consulta.

AUD54 global sigue abierto hasta integrar Dirección/cierre y verificar el release/GUI completos. Véase [núcleo54](audit54-core-delivery.md).
