# H14: preparación de la protección de historia financiera

Estado: definición técnica y preparación de publicación. La aplicación se acredita con evidencia específica de cada release; este documento no acredita un despliegue.

La baja debe conservar los documentos financieros y rechazar vínculos activos directos o indirectos. Los criterios documentales de estado existentes se conservan. La pertenencia de un vínculo estructural no modifica importes, atribución, P&L ni cálculos fiscales; un importe cero puede seguir documentando una relación.

## Compatibilidad prevista

La migración será forward y aditiva. El servidor debe estar actualizado y verificado antes de publicar el consumidor de `diagnosticar_baja_embarque`. El servicio cliente falla cerrado si falta el RPC o si recibe un contrato incompatible, sin volver al diagnóstico anterior basado en consultas separadas.

La lectura del diagnóstico exige capacidad de baja y un objetivo visible dentro de la organización activa. La autoridad global existente del mutador para Super Admin se conserva; el lector nuevo no amplía esa lectura. Los ejemplos de documentos se limitan aparte de los conteos completos.

## Concurrencia y aislamiento

El diseño serializa por organización las mutaciones relevantes del grafo financiero y la baja, mediante mutex transaccional privado. El RPC adquiere el mutex antes del bloqueo de la fila del embarque y vuelve a calcular dependencias. Los escritores y la baja directa comprueban contención sin esperar para evitar ciclos de bloqueo con filas adquiridas previamente; los conflictos deben rechazar la operación completa y permitir reintento.

Las mutaciones protegidas requieren READ COMMITTED. Las escrituras relevantes en REPEATABLE READ o SERIALIZABLE deben rechazarse de forma explícita: un snapshot antiguo puede omitir relaciones creadas después, aunque se bloquee el padre. Las lecturas no cambian de aislamiento ni adquieren un mutex mutante.

La restauración oficial conserva su autorización y ACL existentes. Adquiere el mutex antes de bloquear el padre, vuelve a comprobar identidad, organización y roles tras esperar y recaptura el episodio de baja. Restaura primero el embarque y después sus hijos; los conceptos siguen precediendo a las pólizas. Un fallo de un hijo revierte también el padre y la puerta local de restauración. Los escritores financieros no admiten un bypass mediante esa puerta.

La serialización por organización es una decisión técnica conservadora y puede producir contención entre documentos distintos de la misma empresa. Una alternativa futura sería una coordinación más granular por anclas documentales, con pruebas específicas para grafos inicialmente vacíos, reasignaciones, restauraciones y documentos consolidados. No se debe retirar la coordinación antes de demostrar ese invariante.

La respuesta de cobros concurrentes cambia de forma observable. Antes, dos llamadas simultáneas con la misma llave podían esperar el conflicto de unicidad y devolver éxito. Con la guarda activa, la segunda escritura puede recibir `55P03 / LC_EMBARQUE_EN_USO` antes de llegar a ese conflicto. Debe consultar el estado y reintentar en una transacción nueva con la misma llave; no se promete éxito inmediato de ambas llamadas. El diálogo conserva esa llave mientras permanece abierto. El reintento de un cobro ya confirmado debe devolver los mismos identificadores de pago y movimiento bancario; reutilizar la llave con otro importe debe rechazarse sin modificarlo.

## Alcance que requiere revisión

Se conserva la distinción vigente de estados de CxC, CxP, proformas, pagos, notas de crédito y comisiones. Los vínculos con `activa=false` no se convierten por sí solos en un bloqueo nuevo. Los vínculos estructurales vivos se protegen independientemente de su importe; este criterio de integridad no sustituye las reglas de asignación positiva usadas por reportes y cierres de CxP.

La migración no debe barrer, reparar, borrar ni reinterpretar historia. Los residuales detectados antes de esta corrección se revisan por separado; este cambio no acredita su ausencia en producción.

### Decisión pendiente: anticipos y garantías sin factura

`anticipos_proveedor.embarque_id` y las garantías sin factura de proveedor pueden documentar dinero asociado y no forman parte de los ocho motivos anteriores. Se solicitó una definición de negocio; el candidato no inventa un subconjunto por nombre del estado o saldo. Las alternativas presentadas son bloquear cualquier registro no dado de baja, definir con Contabilidad los estados/saldos que deben bloquear o preparar este alcance en un PR separado.

Los vínculos de garantías que sí tienen factura de proveedor entran en la cobertura CxP. La decisión anterior no cambia esos vínculos ni los cálculos existentes. Hasta resolverla, no se debe certificar cobertura de todas las categorías de dinero asociado al embarque.

## Publicación y recuperación

1. Revisar el SQL forward, su preimagen, ACL y tipos; comprobar el CI del SHA final y los resultados de PostgreSQL aislado.
2. Obtener autorización específica para aplicar en la base remota. Este PR no ejecuta esa aplicación.
3. Aplicar y verificar el servidor mediante un procedimiento revisado; comprobar lecturas y rechazos con datos ficticios autorizados antes de publicar interfaz.
4. Publicar interfaz y verificar el diagnóstico, el rechazo final, el cambio de organización y los reintentos.
5. Si la interfaz necesita volver atrás, conservar las guardas del servidor. Una reversión que retire esas guardas reabre los casos de integridad reproducidos; no forma parte de un rollback seguro.

### Presupuesto de lectura del diagnóstico

La corrección `20261104020000_h14_diagnostico_baja_lectura_acotada.sql` reemplaza únicamente el collector privado. Materializa sus ocho conteos una sola vez y selecciona los candidatos estructurales ajenos antes de evaluar su estado financiero. Conserva las dieciséis comprobaciones de incoherencia, los estados documentales, el contrato versión 1 y una sola sentencia/snapshot. El lector y la validación final siguen compartiendo el collector; no cambian el mutex, las reglas financieras, la autorización ni los límites del servidor.

El problema se reprodujo en PostgreSQL aislado con fixtures ficticios y JIT desactivado: el plan original evaluaba helpers sobre documentos ajenos antes de filtrar sus vínculos. Con 501 proformas terminales ajenas y 326 facturas ajenas, el lector original y una variante que sólo materializaba los conteos agotaron el presupuesto de 8 segundos con plan genérico. El prefiltro estructural completó las 24 lecturas del ensayo, con el mismo payload que el original y 3–19 ms observados en la fase de mayor volumen. Son tiempos de ese laboratorio, no una previsión de latencia productiva ni una prueba HTTP/JWT del candidato.

Las dos regresiones `P04.reader_budget_empty` y `P04.reader_budget_shared` añaden lecturas del RPC público con el rol `authenticated` del fixture SQL, planes custom/generic y dos repeticiones. Cada sentencia de lectura tiene un límite de 8 segundos y debe validar los ocho conteos y el contrato. Se conservan los 140 identificadores anteriores. La finalización del runner no basta: los resultados declarados deben estar completos y aprobados.

Antes de publicar:

1. Verificar revisión y CI del SHA final, incluido el replay con el forward y las dos regresiones de presupuesto. No repetir `20261103100000_h14_baja_embarque_integridad_financiera.sql`.
2. Serializar los despliegues y establecer una ventana sin otro DDL sobre el collector. El preflight detecta una preimagen inesperada al consultarla, pero no bloquea otro reemplazo entre esa consulta y `CREATE OR REPLACE`; si no se puede asegurar esa ventana, no aplicar. Revisar cuerpo, propietario, ACL, firma y configuración. `CREATE OR REPLACE` conserva los permisos y el postflight exige la misma frontera privada.
3. Aplicar únicamente el nuevo forward mediante el procedimiento autorizado y verificar el MD5 del cuerpo `3aafb5cf009c477e626357cb9ba78da8`, la ACL privada y los controles existentes. No elevar el timeout ni retirar comprobaciones para conseguir una respuesta.
4. Desde una sesión legítima con capacidad de baja y organización activa, consultar una sola vez un embarque ficticio autorizado. Validar versión, identidad, conteos, ejemplos y coherencia de `bloqueado`; cerrar sin confirmar la baja. Una respuesta válida bloqueada acredita el lector, no una baja permitida.
5. Mantener la publicación pendiente si esa lectura falla. Las mediciones locales no sustituyen esa comprobación de aplicación. Conservar las guardas H14 al recuperar la interfaz.

## Evidencia del candidato

Candidato SQL: `20261103100000_h14_baja_embarque_integridad_financiera.sql`, SHA-256 `e926236c6a54d353c905477677ae31f5ff1800caed1734c9cf2a65ee457c087e`. La preparación local reconstruyó la base Git e302 con 346 migraciones y cuatro entradas Drizzle; creó historia ficticia antes del forward y verificó que sus datos lógicos no cambiaron al aplicarlo.

El ensayo final aislado `9c7e839d1d704343bf44e2a978ed510f` completó 140 casos: 54 financieros, 26 de autorización, 44 de escritores/restauraciones y 16 de concurrencia. Incluye conversión real local de dos proformas a factura borrador compartida, purga bloqueada antes de borrar anclas, ambos órdenes de commit/rollback, grafos inicialmente vacíos, revalidación de permisos tras esperar y seis rutas oficiales de `restore_record`. Añade restauración histórica válida, rechazo de restauración individual con padre eliminado, rollback completo por cobertura insuficiente y carreras de restauración, baja y revocación. Todos los rechazos comprobados conservaron los datos anteriores a la operación.

El caso agregado de escala comparó siete conjuntos esperados contra el resolver anterior y la implementación nueva, con 2.000 embarques y 80 proformas ajenos a la familia. Los tiempos del fixture son descriptivos y de orden fijo; no estiman latencia o capacidad productiva. El diagnóstico no promete congelar los datos después de responder.

Las cuatro suites conservaron su esquema; la base origen y los roles del cluster quedaron iguales. Finanzas y autorización confirmaron rollback lógico; no se afirma rollback de secuencias. Se verificó la ausencia de los contenedores al terminar. El baseline del repositorio corresponde al quinto clon separado, con el post-migrate de CI y pg_dump 17.9 oficial; las pruebas de seguridad se ejecutaron antes de esos grants de CI.

Después de capturar ese baseline pasaron también ocho regresiones existentes en el quinto clon, con el arnés de CI y ejecución secuencial. Conservan sus comprobaciones de restricciones, cobertura, aislamiento de empresas, restauración y reportes; los fixtures históricos aíslan sólo los triggers nombrados y los reactivan antes de las RPC. La prueba de reportes conserva T1–T8 y sus controles: crea legalmente las finanzas antes de preparar el embarque histórico eliminado. Sus datos y esquema permanecieron iguales al finalizar. Esta evidencia posterior al arnés no sustituye las cuatro suites estrictas anteriores.

Además pasaron 111 pruebas frontend pertinentes con servicios ficticios, TypeScript, la auditoría de arquitectura y ocho pruebas Python de contratos del harness. La autenticación HTTP/JWT firmada, el navegador contra infraestructura desplegada y los proveedores fiscales quedan fuera de esta evidencia.

La lane H14 de `.github/workflows/rls-tests.yml` ejecuta `test_static.py` y `ci_run.py` antes del post-migrate. Su contrato `scripts/ci/h14-integrity/runtime-contract.json` fija los hashes y los 140 IDs; el runner exige el servicio PostgreSQL efímero del mismo job de Actions. Los logs y resultados por caso se publican como artefacto de CI. Esta ruta no aplica SQL en bases remotas.

Estos resultados acreditan el candidato y los límites descritos. La decisión de anticipos/garantías anterior y la aplicación remota siguen separadas.
