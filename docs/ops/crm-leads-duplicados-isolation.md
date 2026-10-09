# Aislamiento de búsqueda de leads duplicados

## Alcance

Forward `20261009031000_crm_leads_duplicados_scope.sql`, revisado originalmente
sobre `54809203bb9ae5ae677e35fc97bcb164fff832e2`. Su composición es el candidato
`13.824.52`, sobre PR207 `454cac1767a3d14bf5eb96123e60067f0039a5fe` y la
normalización de delimitadores de baseline revisada (blob
`32b015f1a5ef0d2dcccb4252ac6f9dc705cc3ad5`). Registra 1,508 migraciones sin alterar
las entradas históricas, incluidas 49/50/51, ni sus forwards. La base remota
vigente debe volver a comprobarse antes de publicar el overlay.
Modifica únicamente el cuerpo de `public.crm_leads_buscar_duplicados(jsonb)`.
No cambia helpers, policies, roles, grants, datos ni contratos del frontend.
No autoriza aplicar la migración en una base remota ni desplegar.

La función existente es SQL, STABLE, SECURITY DEFINER y pertenece a postgres.
Su propietario puede omitir RLS. El filtro `rls_tenant_scope_ok` original
sólo restringe al superadmin: por sí solo no aísla al usuario ordinario.
La prueba sintética previa a la corrección devuelve filas coincidentes de
la segunda organización, aunque el SELECT autenticado sólo ve la primera.
No se han consultado filas reales para demostrarlo.

## Contrato de visibilidad

Se exige `auth.uid()` no nulo y `organization_id = org_scope()`, conservando
`is_org_member`, `rls_tenant_scope_ok` y la unión exacta de las cuatro policies
SELECT vigentes:

- Gestión: `admin` / `gerente_comercial`
- Lectura: `viewer` / `operador`
- Vendedor con lead sin asignar
- Vendedor dueño del lead

Las cuatro ramas usan `has_any_role_in_org`. No se usa un rol global obsoleto
como sustituto de `organization_members`. La jerarquía actual de `viewer`
incluye `vendedor`: éste conserva acceso a leads de otros vendedores en su
organización. El superadmin sólo recibe resultados del tenant activo; sin
selección, la igualdad con scope nulo devuelve vacío.

Se mantienen literalmente la normalización, umbrales de nombre/teléfono,
coincidencia por cualquiera de las claves, DISTINCT, columnas, tipos y firma.
Los leads borrados siguen excluidos. Ausencia de UID/scope/pertenencia se
resuelve con cero filas, no con una excepción nueva.

## Consumidores

La búsqueda del nombre completo en el árbol del commit base identifica un
consumidor de ejecución: `src/features/crm/services/leadsDuplicados.ts`, que
usa el cliente autenticado de la aplicación. Las demás referencias no-SQL
son tipos, documentación de dominio y su prueba de frontend. No se encontró
un consumidor sin usuario en `supabase/functions`, scripts o backend del
repositorio. Esta inspección no inventaría clientes externos ni prueba su
ausencia: son desconocidos.

Se conserva EXECUTE de `service_role`, pero éste también necesita un UID y
un scope autorizado; una llamada sin usuario devuelve vacío. No se añade un
bypass alternativo. Un consumidor externo sin UID debe revisarse antes de
aplicar, si existe.

## Instalación fail-closed

El archivo completo requiere una transacción propiedad del llamador y
stop-on-error. Su primer SAVEPOINT rechaza autocommit antes de modificar
nada. No contiene BEGIN/COMMIT/ROLLBACK de nivel superior; libera únicamente
su propio savepoint. Un error exige rollback del llamador; no se deben omitir
los bloques de pre/postcondición ni partir el archivo entre conexiones.

Admite sólo el cuerpo anterior exacto o el final exacto (reaplicación):

- Anterior SHA-256: `e7beb680647fad4758ade550e2ba4aad40a059965fdec34c4896423a8ba3091c`
- Final SHA-256: `437d1682bf8d95cc7ec2c6f03d3dc2e4e57237a2865c8bdb5d4b77ceb3d617ca`

Requiere sesión/current_user postgres, propietario postgres, firma y tipos
resueltos exactos, y todos los demás atributos portables de pg_proc, incluidos
coste, filas estimadas, nombres/modos de argumentos, defaults, transforms,
soporte, strictness, leakproof, paralelismo, volatility, seguridad y search_path.
No basta con comparar SECURITY DEFINER.

La ACL directa debe ser exactamente EXECUTE de postgres, authenticated y
service_role, otorgada por postgres y sin grant options explícitas. PUBLIC y
anon quedan fuera. Se verifican privilegios efectivos de esos roles: anon
cerrado, clientes con EXECUTE sin grant option y propietario con su legítima
grant option implícita. La postcondición compara la identidad, la tupla completa
no-cuerpo, ACL cruda/expandida y privilegios efectivos de todos los roles con
el snapshot previo; no modifica ninguna concesión.

## CI y evidencia proporcional

El workflow RLS existente activa `scripts/ci/leads-scope/**` y establece
`LEADS_SCOPE_CI=1` sólo para su preparación efímera. Durante replay,
`rls-prepare-db.sh` ejecuta los controles inmediatamente antes del forward
únicamente con ese opt-in; el replay local ordinario no invoca este runner.
El runner verifica el hash del instalador y el destino efímero local, clona la
base precursora y elimina sólo sus propias clones. No usa llaves ni variables
de conexión remota. Los cambios de membresía de controles negativos quedan
dentro de la misma transacción fallida y se verifica su rollback.

Controles: primera aplicación, reaplicación idéntica, rollback del llamador,
autocommit rechazado, cuerpo desconocido, target ausente, owner/coste/filas/
volatilidad/seguridad/search_path incorrectos, grants directos faltantes o
extra, grant option cliente, anon heredado, grant options heredadas por ambos
clientes, alteraciones de cuerpo/ACL/metadatos antes de postcondición y snapshot
transaccional ausente. La comparación de estado abarca dump, roles,
membresías, función y permisos efectivos. Se conserva la grant option del owner.

`test_rls_crm_leads_duplicados_scope.sql` se descubre automáticamente con las
suites RLS existentes y termina en ROLLBACK. Comprueba dos tenants, 17 roles,
roles globales obsoletos o ausentes, ausencia de membresía/UID, service_role,
superadmin sin tenant/cambio/limpieza, borrados, datos vacíos y normalización.
El oráculo independiente usa SELECT con RLS activo y compara las nueve
columnas completas y multiplicidad, además de los IDs esperados del fixture.

Validación local focal: PostgreSQL 17.9, prueba original roja por fuga del
fixture B, prueba corregida verde, cero skips, y controles del instalador.
No se ejecuta una suite local amplia. El CI del commit publicado debe volver a
verificar replay, baseline PostgreSQL 17.9, guards y suites; un resultado local
no demuestra despliegue ni estado de la base remota. El workflow conserva
`leads-scope-envelope-evidence` con cada control y la limpieza de clones.

La baseline cambia únicamente en el cuerpo de esta función. Al componer con
otras ramas se debe aplicar ese delta, nunca sustituir la baseline completa.

## Composición y verificación final

El SQL forward conserva SHA256
`d55c2e99c1946bd7deca6aa5b33fcda19181404ce399455918936a2709ff2d6d`.
No se repiten suites locales para componerlo: los 25 controles y la regresión
focal PostgreSQL 17.9 corresponden a la evidencia del autor. La revisión de
integración verifica estáticamente hashes, CI, manifest, mirrors e historial.
El baseline se conserva por delta de una función sobre la normalización
aprobada; su igualdad con el replay completo la decide Actions del commit exacto.
Antes de cualquier aplicación remota deben comprobarse predecesor, ACL,
atributos, ledger, transacción de instalación y posibles consumidores externos
sin usuario. Esta composición no acredita ese preflight ni autoriza activación.
