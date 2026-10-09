# Selector148: candidato dependiente 13.824.50

Este candidato depende del padre financiero 13.824.49. Registra `20261009012000_audit148_integridad_selector_deshabilitado.sql` después de los forwards de cobertura y papelera del padre. El manifest conserva todas sus entradas históricas y añade la lista completa de 1,506 migraciones para 50; no crea 45 ni cambia la identidad de 144.

## Alcance y estado de entrega

La migración conserva el instalador revisado SHA256 `a402f3f649d19a13c75d353b18ba866fcc6e7581d8a1a784a7da2e0128722522`. Su única diferencia de registro es el comentario `audit:allow-no-grants` admitido por H6 inmediatamente antes de la función, porque el RPC está deliberadamente cerrado a todos los roles de aplicación. El archivo registrado tiene SHA256 `a9d4cca98c6b2737faf57a389de482c9e1e454cedb9d7f30db6946de769d6b10`. El verificador comprueba ambos hashes y sólo admite retirar ese comentario exacto; no normaliza cambios ejecutables.

Instalación, seis FK compuestas, validación de todas las filas, precondición de integridad, función y ACL forman una sola transacción. Una anomalía revierte todo, sin reparar ni borrar históricos. Se conservan las claves UUID globales, la ausencia de herencia de tablas, los 24 triggers internos exactos y la unicidad de póliza activa. La función vuelve a comprobar ese contrato antes de calcular elegibilidad.

El resultado autorizado sigue limitado a admin, admin_org, super_admin, coordinador_logistico y gerente_operaciones, además de los permisos de lectura/escritura existentes y la organización activa. Devuelve únicamente los cinco campos de cabecera revisados y el cursor de una fila elegible. No abre asignaciones ocultas, otro tenant, nuevas funciones compartidas ni nueva aritmética financiera.

## Por qué UI y RPC siguen apagados

El usuario ya autorizó crear y habilitar el selector148 en el proyecto `341dfc00-0308-4aba-9246-e4b2041e31f1`. No falta otra autorización para esa misma capacidad. Este PR conserva la compuerta SQL y `SEGURO_FACTURA_SELECTOR_ENABLED` en false porque todavía debe acreditar el commit publicado mediante Actions y comprobar el esquema y los históricos del destino real. Publicar código no demuestra que esos seis constraints estén validados allí.

Una vez que el padre confirme ese destino, el commit exacto y los seis constraints validados/enforcing, la activación mínima ya autorizada es:

1. Verificar que la función deshabilitada, su propietario, configuración y ACL corresponden al candidato revisado, sin drift.
2. Ejecutar una transacción corta derivada de `variants(installer).enableSql`: conserva los locks y la precondición completa de catálogo; cambia sólo la constante de la misma función a true y concede EXECUTE a authenticated. El filtro positivo de cinco roles sigue dentro de la función. No vuelve a instalar constraints ni modifica datos. Si la integridad no está lista, falla antes del cambio.
3. Publicar el único cambio de compuerta UI a true con su regresión de activación y comprobar el selector en la empresa/organización aprobada. Mantener la ACL real, el baseline del estado habilitado y la evidencia del commit alineados.

El padre es responsable de esas comprobaciones de destino, aplicación y GUI. Este candidato no ejecuta la activación ni solicita repetir la autorización. No exige un permiso más amplio ni autoriza inferencias entre empresas.

## GitHub Actions como gate principal

No se añade otro workflow amplio. Son obligatorios `CI Success` y `RLS tests result` para el SHA exacto del PR. El workflow RLS existente incorpora el runner serial de `scripts/ci/selector148/`, usa sólo su servicio PostgreSQL desechable y verifica el instalador registrado por hash. Los 65 negativos de estructura/enforcement, rollback histórico y post-grant, roles, paginación, paridad exacta, concurrencia, cancelación y presupuesto corren en bases propias. Las fixtures con DDL o commits no entran en el manifiesto paralelo.

`_ci_post_migrate.sql` captura y verifica la ACL del selector antes del GRANT genérico, y después restaura sólo su estado ya comprobado. La migración no obtiene verde por una reparación que oculte grants indebidos. El guard de papelera conserva 60 casos válidos y sustituye la antigua inserción de tombstone ajeno por cuatro assertions explícitas de rechazo 23503 / insurance_pf_same_org_fk y preservación del estado. La antigua evidencia roja queda como evidencia histórica, no como un pass inventado.

La UI usa los 16 archivos de la revisión deshabilitada final (156 tests previos); las pruebas temporales del backend habilitado se limitan a clones de CI. Se eliminan dos entradas duplicadas `test_rls_*.sql` del manifiesto porque siguen descubriéndose automáticamente. Quedan 212 guards de manifiesto y 50 suites RLS automáticas.

## Baseline, tipos y límites de validación

El baseline se compone estáticamente del baseline financiero conservado más la función, siete constraints y ACL registrados en el catálogo ya probado de la revisión local. Retirar esas adiciones reproduce byte por byte el baseline padre. Los tipos añaden la firma RPC y las relaciones compuestas sin retirar entradas anteriores. El espejo canónico conserva el cuerpo revisado.

Esta composición no se presenta como un dump nuevo: la equivalencia exacta con PostgreSQL17.9, el build/typecheck completo y el runtime pertenecen a Actions. Si el dump nativo expone una diferencia de formato u orden, debe corregirse sólo esa diferencia revisada; no debe relajarse un guard ni reescribirse historia para obtener verde.

No hubo ejecución SQL, suite amplia local, navegador, despliegue, Git remoto ni lectura de secretos durante este empaquetado.
