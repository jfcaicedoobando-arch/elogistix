# Aplicación posterior: empresas propias del KAM a Prospecto

Propuesta 13.824.85 sobre `main` 9b62217f8742f430da494f7ffdffab41d318ccbc.
Este documento prepara la aplicación; no acredita una aplicación ni publicación.

## Contrato

La ruta anterior de `_assert_writer` se conserva literalmente. La excepción nueva
es exclusiva de `crm_empresa_pasar_a_prospecto(uuid)`: requiere membresía exacta
`vendedor` en `org_scope()`, organización habilitada y empresa viva con
`created_by = auth.uid()` explícito. No usa el rol vendedor global como sustituto
de la membresía. No cambia el helper compartido, RLS ni otros roles.

Si existe lead, debe estar vivo, en la misma organización y tener al actor como
`vendedor_id`; no puede estar Convertido ni tener cliente convertido. Cada vínculo
y oportunidad deben pertenecer al mismo tenant; cada oportunidad debe estar viva,
ser del actor y tener exactamente el lead de origen de la empresa. Se revisa todo
el conjunto antes de elegir la oportunidad y antes del retorno idempotente.
Una empresa Cliente o con `cliente_id` no entra por esta nueva ruta. No se reasigna
ni se reactiva ningún registro. Los propietarios se bloquean durante la llamada.

La autoridad final es el servidor. La UI consulta el creador, contexto de membresía
y vínculos disponibles bajo RLS; una relación completamente oculta por RLS puede
producir un rechazo del servidor aunque el botón haya pasado su comprobación local.
La excepción utiliza el `created_by` persistido; no añade una política global de
inmutabilidad de ese campo ni cambia las policies de edición ya existentes.

## Orden exacto después de revisión y merge

1. Confirmar el SHA final del PR y volver a revisar el diff de la única migración
   `supabase/migrations/20261016060000_crm_empresa_prospecto_kam_propio.sql`.
   Confirmar Actions CI, gitleaks y `RLS tests result` del mismo SHA. Las regresiones
   SQL sólo se ejecutan en PostgreSQL desechable; nunca en una base real.
2. En Lovable, inspeccionar de sólo lectura la función y su metadata con la consulta
   siguiente. Comparar con la preimagen revisada, sin reparar ni renumerar historiales.
3. Tras la autorización de aplicación, ejecutar **sólo el archivo forward completo**,
   desde `BEGIN` hasta `COMMIT`, en una conexión de migración de Lovable. No ejecutar
   `supabase db push`, seeds, bootstrap, `_ci_post_migrate.sql`, suites RLS, migraciones
   históricas ni archivos de los PR diferidos 346/351/356/360/363. No copiar un fragmento
   aislado del cuerpo. El preflight aborta si fuente, firma, owner o ACL difieren.
4. Repetir la consulta de lectura: MD5 postimagen
   `3f909f4d6d3e426c1e962909b1e55bcf`, mismo OID y metadata. La migración también hace
   esta comprobación dentro de la transacción y admite reejecución de su postimagen.
5. Publicar la UI 13.824.85 por el flujo autorizado. En una cuenta/empresa de prueba
   autorizada, confirmar Lead propio sin lead → Prospecto con una oportunidad propia;
   reintento devuelve el mismo ID sin duplicados. Comprobar botón/mensaje en una empresa
   ajena sin modificarla. No usar datos de clientes como fixtures.

```sql
SELECT p.oid, p.oid::regprocedure AS firma, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proconfig, p.proacl, md5(p.prosrc) AS source_md5,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.crm_empresa_pasar_a_prospecto(uuid)');
```

Preimagen esperada: MD5 `1d8a763368ef97c02634860df5008a7c`, owner `postgres`,
`SECURITY DEFINER`, `search_path=public`, ACL exactamente `postgres`,
`authenticated` y `service_role` con EXECUTE. El postcheck conserva todos los
atributos de `pg_proc` salvo el cuerpo `prosrc`. Si falla una comprobación, detener
la aplicación y revisar el drift; no editar la base para forzar el preflight.

No se inicia la fase 2. Merge, aplicación y publicación quedan a cargo del root.
