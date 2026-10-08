# Release13.824.44: Por pagar canónico

Paquete local sobre43 a7e0eeb193473f1729410d28054316be9da009c2. No publicado; sin SQL remoto, GUI, PAC ni hosting. Revisión independiente pendiente.

## Fuente y alcance

Candidato c5894161d3978a3b44bca81fe49049af6b135ae3; delta contra d95b8e7a6fd86cdbfa298f6743ae9daffe6db12f verificado en accounting-splits-final/index.json. Migración20261007001700 SHA-256 b7d5eab0c5e310a589cf04271b1650a789582493ff15884fe3ff707e14663a2e; SQL, espejo, suite SQL y prueba frontend idénticos a fuente.

Sólo cambia el cuerpo de public.cxp_por_pagar(). Saldo y pagado provienen de v_proveedor_facturas_saldo en moneda documental; NC Aplicadas reducen saldo sin contarse como pagos, respetando congelado134 y precisión. Conserva firma, filtros, fechas, orden, límite, owner, ACL y privilegios efectivos. No incorpora lógica nueva, DML, backfill, tablas ni triggers. Mantiene Aging43, CxC Timbrada/Aplicada, referencia NULL131/134, cronología135, cierre139 y captura62/130. Manifiestos35–43 y todas las migraciones históricas permanecen intactos.

## Reintegración obligatoria

Este padre aún no contiene replay tarifario39/Drizzle0010 reservado20261006234000 ni correcciones main2538. Antes de publicación, reintegrar y repetir verificaciones sobre SHA final. No se certifica compatibilidad global, cierre GUI, build ni tipos app de44. Tipos app43 terminó137; no se ha confirmado error TypeScript. No mezclar148/P&L en este paquete.

## Verificación y futura aplicación

Validar replay limpio44 y baseline; forward43→44 dos veces con datos históricos intactos y comparación completa de funciones antes de grants CI: sólo cuerpo Por pagar distinto, sin cambios de owner/ACL/privilegios/firma/defaults/retorno/atributos. Ejecutar suites131/134/135/139/62/130/Aging/Por pagar, guardas/RLS/CAS37, husos UTC/CDMX y pruebas frontend enfocadas. La evidencia de43 no sustituye ejecutar44.

Aplicación futura requiere backend/proyecto confirmado, historiales Supabase/Drizzle, hashes, duplicados y high-water marks; verificar35–43 efectivos y cuerpo previo exacto. Preparar envelope transaccional con locks/timeouts, precondiciones repetidas y registro único001700. Comparar catálogo/datos/historia antes de COMMIT y desde nueva transacción. Drift implica ROLLBACK; transporte incierto requiere releer. Nunca ejecutar fixtures en backend real.

## Resultados locales44

Replay limpio PostgreSQL17:294 migraciones aplicadas y1 migración de datos omitida por el harness oficial. Snapshot completo igual a baseline;197/197 guardas y49/49 suites RLS pasan. Forward43→44 aplicado dos veces:137 tablas y222 filas originales byte-idénticas tras cada aplicación. Catálogo de666 funciones previo a grants CI conserva identidades, owner, ACL, privilegios efectivos y atributos; sólo cambia el cuerpo cxp_por_pagar. Forward y replay convergen a snapshot/catálogo idénticos. Regresión Por pagar roja en43 y verde en ambas aplicaciones44. Suites131/134/135/139/62/130/Aging y CAS37 pasan; Por pagar/captura/cierre en UTC y America/Mexico_City pasan. Integridad final pasa. Una fila sintética user_roles añadida posteriormente por _ci_post_migrate es identificada y separada de la preservación histórica.

El audit-rpc-columns sale1 con seis referencias heredadas: output y status son byte-idénticos entre43 y44. No se presentan como corregidas. Verificación de archivos:1487 migraciones, todas las entradas35–43 y8396 archivos parent fuera del delta permanecen idénticos. Frontend enfocado y auditorías estáticas pendientes al momento de esta nota; tipos/build44 no ejecutados para evitar repetir el límite de recursos137 de43.

## Recomposición local sobre main2538 y replay0010

Este candidato recompone el delta revisado `1c29d9c4086ada36bc2abc5c6c42a7f09094f0af` sobre el padre `397e5ee44e970af9ab3ea3a4ea2a95a26e442025`. Conserva el release39 revisado `32912a4fb8f3cd99af5c20644ee80b0b1b9986fa`, el replay Drizzle0010, su forward restrictivo234100 y los cambios CRM/Costeo heredados. Los manifiestos históricos35–39 permanecen iguales al nuevo39; sólo se actualiza la entrada inédita44 para incluir el inventario real. El SQL propio del paquete conserva sus bytes y SHA-256 de la fuente. Las validaciones descritas arriba pertenecen a la fuente histórica y no certifican esta nueva composición; la validación conjunta de la cadena se registra por separado. No se aplicó SQL remoto, no se publicó frontend y no se actualizó ningún PR.
