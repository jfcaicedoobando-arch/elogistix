# Release 13.824.41: base documental por capturar

Estado: composición local para revisión. No publicado en GitHub, no aplicado a un backend remoto y sin hosting. Este documento no es un envelope ejecutable ni prueba el cierre GUI de los hallazgos 62/130.

## Fuente y dependencias

- Base exacta40: `c87a4229af9a5c269a048374d9c5cf3f17ec3821`, árbol `3680f7268b27652a6828b6e0609b5ae5eac096a2`.
- La base contiene 39 corregido (`3951f5c5693344ec6895ad599ba409c1abd9ec38`, procedente de 22e65c2), incluido el CASE final que preserva una referencia de devolución nueva NULL en los tres consumidores, y main `003c8a7f4306e1f3ea0d7633985c496690b9e4b4` con 38, PDF 182 y copy 183. No se recomponen desde fuentes antiguas.
- Fuente62/130: `8b59e2d8868fb92c9b1c27cc7e48f18e884d5492` + `cee417a03d0b00d260d0fe7dd5efbad808a67b6b`, sobre `5daa8a9e5dff04c81b0fabeae113d1fdd70f7867`. La segunda revisión registró la suite SQL y retiró la alteración de un manifest histórico.
- SQL nuevo único: `20261007001000_audit62_130_cxp_captura_base.sql`, SHA-256 `cc326f4f4766d3747e477fd37bfb1642b4268c44bc9ecc0f78443bb65a58e818`. El cuerpo de función y la suite fuente se conservan byte a byte; migración y espejo omiten únicamente el GRANT final redundante de la fuente, tras la comprobación de ACL descrita abajo.
- Orden de código y aplicación: 35 → 36 → CAS 37 → cronología 38 → devolución 39 → importe congelado 40 → captura 41. El empaquetado41 no certifica aplicaciones previas; el estado real debe verificarse en el backend elegido.
- El manifest añade sólo la entrada 41 y, respecto a40, sólo01000. Todas las entradas 35–40 y sus archivos anteriores quedan intactos. No se usa el actualizador que poda entradas históricas.

## Delta exclusivo

La única función redefinida es `cxp_por_capturar()`. Mantiene la firma MXN/USD, SECURITY INVOKER, STABLE, search_path, límite 500, owner y ACL existentes. No se cambian tablas, triggers, policies, tipos ni otras funciones. No se modifica el origen de los costes ni se hace backfill.

La bandeja muestra base fiscal capturada sin IVA, no deuda pendiente ni P&L. No resta NC o pagos y no convierte FX. La asignación exige monto positivo y cantidad efectiva positiva (fallback histórico NULL/0→1), costes vivos y no ajustes, y relaciones de la misma organización. Agrupa una vez por factura/embarque; conserva residuos parciales y limita el exceso proporcionalmente al subtotal. Sólo usa cabecera cuando no hay asignaciones efectivas. Canceladas/borradas no aportan importes, conteos ni fechas; los borradores siguen capturados. Base cero conserva pertenencia y conteo sin dividir por cero.

Frontend cambia sólo Por capturar: etiqueta Base sin IVA y comparación/presentación con redondeo canónico. No modifica los pasos del wizard ni las etiquetas de captura/resumen arregladas por copy 24. La validación del paso visible, cancelación/reapertura y moneda única se vuelven a probar como regresiones. La firma histórica no expone EUR; ampliar ese contrato queda fuera de este paquete.

No se incluyen otros splits 139, 70, P&L ni cambios nuevos de 131/134. Sus implementaciones revisadas se heredan intactas de 40, igual que PDF/Sentry y los manifests y changelog anteriores.

## Corrección de empaquetado detectada antes de CI

El primer ensayo de forward40→41 comprobó el catálogo antes de los GRANT de pruebas. Detectó que el SQL fuente añadía `service_role=X/postgres` a la ACL explícita, aunque service_role ya heredaba EXECUTE por el grant PUBLIC existente. La autorización efectiva no cambiaba, pero la ACL completa sí. Por tanto, el paquete elimina ese GRANT redundante, conserva sólo CREATE OR REPLACE y no revoca ni concede permisos. No se amplía acceso ni se modifica el cuerpo de negocio.

El hash fuente original fue `b4626e970ca8af69e673e8c0e9e6e04b2e85511a07515246de10ee15d7cc8416`; el hash nuevo figura arriba. El comprobante original de ACL de la fuente comparaba después de haber instalado ese grant; no demostraba la preservación desde 40. Esta desviación mínima fue revisada independientemente y exige replay/forward nuevos antes de cerrar el paquete. Se conserva la evidencia del primer intento como fallo detectado, sin reetiquetarlo como PASS.

## Publicación apilada propuesta

1. Conservar el commit/árbol revisado40 como padre exacto. Publicar 39 y 40 en su orden y verificar sus objetos remotos/CI; no presentar41 sobre main 003c como si fuera un delta aislado.
2. Después de la revisión independiente de 41, publicar su rama y abrir PR draft contra la rama 40 verificada. El diff de revisión debe contener sólo los archivos de41; el stack contra main incluye39/40 como dependencias explícitas.
3. Si 40 se fusiona, cambiar la base del PR 41 al main que contenga ese árbol. Si el upstream añadió cambios concurrentes, reconciliar sólo el delta41 y repetir preservación, tipos, pruebas y build sobre el SHA exacto que se publicará. No reemplazar snapshots nuevos con cuerpos de la fuente antigua.
4. Verificar remoto y CI del SHA publicado antes de considerar merge. Merge no aplica SQL ni publica hosting. Estos pasos están pendientes; no se han creado ramas remotas ni PR por este paquete.

## Preflight de aplicación futura

Identificar el backend/proyecto y mecanismo autorizado; leer ambos historiales Supabase/Drizzle, duplicados, high-water marks y hashes. Exigir los prerequisitos aplicados y verificar ausencia de01000 y de una implementación equivalente bajo otro nombre. No usar reset, repair ni include-all para forzar orden.

Capturar catálogo completo antes de actuar: cuerpo/signatura de `cxp_por_capturar`, retorno/defaults, owner, ACL canónica, privilegios efectivos, invoker, volatilidad y search_path. Comparar con40 revisado y conservar las funciones protegidas37–40. Si la función avanzó a otra implementación, detener y reconciliar. Los GRANT generales del harness local de CI no son permisos de publicación ni son parte de la migración.

Sólo después de un envelope específico revisado, una transacción con límites de lock/sentencia/inactividad, serialización de historiales y precondiciones repetidas debe aplicar el SQL exacto y registrar únicamente esta migración en el mecanismo aprobado. Comprobar el único cuerpo nuevo y preservación de todos los demás objetos, roles/ACL e historiales antes de COMMIT. No ejecutar fixtures o pruebas de negocio contra el backend real.

Si hay drift, permisos inesperados, timeout o duplicados: ROLLBACK. Una respuesta de transporte incierta exige releer catálogo/historial antes de reintentar. Después de COMMIT, confirmar desde otra transacción. Ante un problema posterior, preparar un nuevo forward revisado; no reescribir datos ni restaurar ciegamente definiciones históricas.

## Verificación funcional posterior

Tras SQL y frontend publicados por separado, comprobar en la empresa de prueba autorizada: FP13 base 1000/1000 sin IVA 160 como exceso; ELNAC17 base 100/presupuesto 120.44 con una factura; ELNAC16 base 60+40/presupuesto 100 con dos facturas. Verificar fechas, conteos, MXN/USD separados, filtros, copy 24 de moneda única y retorno al paso visible al corregir. No declarar cierre de 62/130 o de los 150 antes de esa evidencia. No requiere PAC ni una operación fiscal real.

## Validación original de 615d92d (2026-10-07), anterior a la propagación de referencias

- PostgreSQL 17.9 aislado: replay limpio de 291 migraciones posteriores al squash; una migración de datos se omite conforme al inventario vigente del repositorio. El snapshot completo coincide exactamente con el baseline del paquete.
- Guardas oficiales: 192/192 PASS. Suites RLS: 49/49 PASS, incluidas CAS 37, permisos por rol y aislamiento. Las 27 comprobaciones de captura se ejecutan además bajo UTC y America/Mexico_City.
- Rojo controlado sobre 40: FP13 capturaba 1160 frente a 1000 de base. Dos aplicaciones locales consecutivas del SQL 41 corregido pasan la suite y conservan todas las filas de 137 tablas públicas (161 filas, incluidas asignaciones y devolución histórica sintéticas). El forward40→41 converge al catálogo/snapshot del replay limpio antes de los GRANT de CI.
- Catálogo ampliado: 666 funciones existentes, sin altas ni bajas. Sólo cambia el cuerpo de cxp_por_capturar. Permanecen firma/retorno/defaults, owner, ACL explícita completa y privilegios efectivos, lenguaje, clase, invoker, volatilidad, search_path, strict, leakproof, parallel, cost, rows y support. Seis suites de forward de captura/131/134/135, CAS 37 e integridad pasan después.
- Frontend: 94/94 en 17 archivos. Incluye 24 pruebas de la fuente 62/130,67 regresiones de copy 24/wizard/importes y 3 de registro de guardas. Los casos de paso visible conservan datos y enfocan el control pendiente; cancelación, reapertura, moneda única y precisión continúan verdes. La revisión independiente repitió 19/19 pruebas en 3 archivos, sin cambiar después ese frontend.
- Tipos app/node PASS con heap máximo 3072 MB. Build minificado PASS en 1 min 22 s con Terser maxWorkers=1 desde el primer intento; bundle de entrada 207 KB gzip, bajo presupuesto 365 KB. Sourcemaps ausentes y licencia de la fuente PDF conservada. Todo trabajo pesado se serializó mediante el lock compartido.
- PASS: higiene de migraciones, 174 espejos canónicos,198 firmas de replay/mirror, manifest 1485, RPC-sync, columnas frontend/schema, higiene de tests, arquitectura y ESLint de TypeScript afectado. Se conservan dos divergencias espejo conocidas y la excepción previa de 208 líneas de date-picker-mx-helpers.
- El guard RPC-columns sigue saliendo 1 por seis referencias preexistentes en funciones ajenas (_embarque_aplicar_tarifa_decidida, crm_reporte_datos y _venta_facturada_por_embarque). Los resultados/exit de 40 y41 son idénticos byte a byte; no se altera el allow-list ni se presenta como PASS global.
- Preservación comprobada: 1484 migraciones previas, entradas 35–40 del manifest y changelog histórico intactos; 998 archivos protegidos iguales, incluidos los cuatro blobs exactos de copy 24, 131/134, PDF y Sentry/package-lock. La única desviación frente a la fuente es el GRANT redundante explicado arriba.

Límites: sin suite frontend completa, navegador/GUI, CI remoto, SQL remoto, PAC, hosting ni cierre funcional de 62/130. La primera comparación de ACL fallida se conserva como evidencia; la entrega final exige el commit/árbol revisado y no reutiliza ese intento como validación satisfactoria.

## Propagación de 39/40 corregidos antes de publicar

El paquete 40 anterior 45577b9 y su SQL 134 de hash 9d0fea4d quedan sustituidos como dependencia. El nuevo padre c87a422 incorpora SQL 131 SHA-256 `9e1d651b437aaa05a04a71dfb9b95eda35343bc32b3f9dd84f22520af292d2af` y SQL 134 SHA-256 `9bcbbf4166368dc95f1a7e64290658001af59a81ca27ca10164e443a2b6480a2`. Cada uno cambia sólo la expresión final de referencia del estado de cuenta: medio conocido conserva `referencia_devolucion`, aun NULL; sólo legacy conserva la alternativa original. Se heredan también la prueba 131 reforzada y el selector exacto de función del test N2.

La propagación no modifica SQL 62/130, su espejo, su suite, su frontend, APP_VERSION 41, CHANGELOG ni los manifiestos 35–41. El SQL 01000 mantiene SHA-256 `cc326f4f4766d3747e477fd37bfb1642b4268c44bc9ecc0f78443bb65a58e818`; el resto del baseline es idéntico, salvo el único CASE heredado. Los commits y logs originales permanecen como evidencia histórica.

La revalidación del 40 corregido tiene replay 290, 191 guardas, 49 RLS, forward 39→40/catálogo/datos, 84 pruebas frontend, tipos Node, typecheck aislado del test N2 y build serial PASS; la app completa quedó limitada por memoria, sin diagnóstico de error de tipos. Esos resultados no certifican por sí mismos esta nueva composición 41. Antes de publicarla o fusionarla, repetir las verificaciones pertinentes del stack 41 exacto y resolver el typecheck app en CI; no presentar los resultados originales arriba como una ejecución nueva. Esta preview no aplica SQL, PAC ni hosting.

## Recomposición local sobre main2538 y replay0010

Este candidato recompone el delta revisado `7ecd03bff6208c1e78f039effe3ad36c6ec5611c` sobre el padre `8c9c251561a941885062a196b70b07516c5f5b61`. Conserva el release39 revisado `32912a4fb8f3cd99af5c20644ee80b0b1b9986fa`, el replay Drizzle0010, su forward restrictivo234100 y los cambios CRM/Costeo heredados. Los manifiestos históricos35–39 permanecen iguales al nuevo39; sólo se actualiza la entrada inédita41 para incluir el inventario real. El SQL propio del paquete conserva sus bytes y SHA-256 de la fuente. Las validaciones descritas arriba pertenecen a la fuente histórica y no certifican esta nueva composición; la validación conjunta de la cadena se registra por separado. No se aplicó SQL remoto, no se publicó frontend y no se actualizó ningún PR.
