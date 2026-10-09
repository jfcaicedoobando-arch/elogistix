# AUD54: composición de Dirección y cierre CxC

Base: `jfcaicedoobando-arch/elogistix`, main `2a35c130d74089c2cda4a04cb8c1b5cb03381142`.
Trabajo en clon aislado y HEAD separado; sin publicación de ramas/PRs, BD real ni navegador.

## Contrato y dependencia

Esta entrega contiene solamente los dos consumidores pendientes. El núcleo54
pertenece al paquete financiero49 que coordina Dot y debe componerse antes de
validar/publicar el frontend. No se vuelve a incluir ni modificar ese núcleo.
Contrato consultado en candidato `9bdd95003b7837dbc8ab70d6f037985964828bf8`,
`docs/audits/audit54-real-cent-residual.md`, y confirmado por Dot durante esta tarea.

Deuda monetaria: `ROUND(saldo nativo,2)>0`, half-away-from-zero. La clasificación
ocurre antes de conversión a MXN, con resta Decimal/numeric. El saldo exacto,
aplicaciones, NC, tipo de cambio, banco y estado persistido no se reescriben.
Pagada con pago activo aplicado positivo puede mostrar residuo; Pagada sin esa
evidencia conserva su ámbito legado. El diagnóstico no ofrece otro cobro PUE.

Para las pruebas TypeScript se importaron sin cambios, exclusivamente en el clon,
los dos archivos centrales del candidato. Sus blobs son:

- `src/lib/financial/saldoFactura.ts`: `b95aac35a86dcd0c10807307ee6f775d1b7ef46a`.
- `src/lib/financial/toleranciaPago.ts`: `74921a52dfdf2b747e6f94ee664f95e52bb2c9b3`.

Estos archivos no forman parte del patch de consumidores.
Dot informó parent financiero205 `1dffdd4a` con los ocho blobs centrales
conservados; esta revisión no incorpora ni edita ese paquete.

## Delta

- Dirección incluye Pagada en la lectura y conserva org, RLS, IDs, paginación y
  exclusión de borrados. El consumidor delega saldo/clasificación en el canon
  central; aging y hero consumen la misma decisión nativa. Se elimina el umbral
  MXN0.50 y el descarte automático de Pagada. La valuación usa el saldo exacto y
  redondea por factura antes de agregar. Sin TC válido se conserva valuación0,
  sin confundirla con ausencia de deuda nativa.
- Cierre CxC usa saldo_factura canónico, evidencia de pago vigente en la misma
  organización y ROUND por factura; un centavo documentado bloquea la regla.
  Pagada sin evidencia conserva saldo cobrable0 y diagnóstico de legado.
  Pagos anulados/borrados no cuentan. El detalle de NC conserva Timbrada/Aplicada
  y conversión por el helper central, equivalente al canon vigente
  `_nc_aplicadas_moneda_factura`; no usa el helper antiguo Aplicada-only.
- La forward nueva `20261009005400_audit54_cierre_cxc_saldo_real.sql` requiere la
  preimagen efectiva exacta de AUD139 y el catálogo aprobado ANTES del DDL:
  owner postgres; plpgsql SECURITY DEFINER, UUID → JSONB, search_path public y
  atributos/defaults exactos de main; ACL efectiva sólo EXECUTE de postgres,
  authenticated y service_role, grantor postgres y sin grant options explícitos.
  Rechaza grants faltantes/extra, otro grantor y atributos inesperados; no repara
  drift. Los REVOKE/GRANT existentes sólo reafirman la ACL que ya pasó el guard.
  Captura privilegios efectivos de TODOS los roles y PUBLIC mediante
  `pg_catalog.has_function_privilege`, por separado EXECUTE y WITH GRANT OPTION.
  Exige anon/PUBLIC false/false, authenticated/service_role true/false y
  postgres true/true (autoridad implícita legítima del owner); rechaza NULL.
  Valida esos pares antes/después y toda la matriz efectiva idéntica después,
  conservando privilegios legítimos de otros roles sin filtrar sujetos.
  Emite la función completa y valida metadata, ACL, privilegios y hash después.
  SAVEPOINT/RELEASE exige la transacción del caller y rechaza autocommit antes
  de cambios; no incluye BEGIN, COMMIT ni ROLLBACK propios. Un error aborta la
  transacción y el caller puede hacer rollback completo o al savepoint.
  El espejo y sólo ese cuerpo del baseline coinciden.
  No se editan migraciones antiguas ni otra regla de cierre, NC/impuestos,
  atribución CxP/multiembarque, PNL, comisiones o REP.

## Evidencia y límites

Evidencia previa: 78 tests de Dirección en seis archivos y 20 tests de contratos
SQL/Fase D en dos archivos. Por instrucción expresa, esta revisión no repite
ninguna suite local. Los nueve archivos funcionales permanecen idénticos a la
entrega original; los controles nuevos se validarán en GitHub. Lint del archivo
afectado, diff-check, Python/YAML y aplicación de patch son controles estáticos.
Incluye 0.01/0, 0.0049/0.005 nativo, FX, varias NC, pago+NC, Pagada con/sin
evidencia, terminales, scope del loader y preservación de otras reglas.

La nueva fixture SQL RLS tiene 16 casos principales más agregación nativa por
factura y multimoneda, NC/REP/borrados, rechazo del segundo PUE, snapshots de
hechos sin escritura del lector, acceso otra org y ACL. CI la descubre como
`supabase/tests/rls/test_rls_*.sql`. No se ejecutó PostgreSQL ni replay local.
La comprobación de guards TypeScript es estructural; no prueba runtime SQL.

Los controles focalizados se integran obligatoriamente en `RLS tests result`
del workflow SQL existente. `rls-prepare-db.sh` captura el checkpoint schema-only
inmediatamente antes de aplicar la forward, restaura un clon efímero y ejecuta
`scripts/ci/audit54-cxc-forward-runtime.sh` antes de continuar el único replay.
No hay workflow independiente ni segundo replay completo. Un fallo del hook
aborta el job existente; no hay skips por allowlists ni continue-on-error.
Sus 27 casos comprueban owner/atributos/ACL inesperados, grants faltantes/extra,
rollback del caller, autocommit rechazado y rollback ante postcondición tardía.
Los dos casos de herencia ejecutan `GRANT authenticated TO anon` sólo en
transacciones de fixture con rollback, comprobando proacl intacta y ausencia de
drift global de membresías al terminar; cubren preguard y fallo tardío.
El primer caso aprueba el checkpoint real antes de cualquier reset de función.
No invoca la función financiera ni sustituye suites RLS.
Las fault fixtures se generan con `scripts/ci/audit54-cxc-runtime-fixtures.py`.
Python sintaxis/generación, YAML y parsing AST Bash pasan localmente; `bash -n`
y runtime SQL están preparados para CI y no fueron ejecutados localmente.

El cuerpo funcional revisado se conserva literal: SHA256
`17217b03c4a5d5241347d41f1edffe261ef7b905ddd7b0dcb26078a9f1ccaf77`.
Dot verificó por lectura el catálogo de destino sin deriva y una preimagen con
SHA256 `b570c064e38d1f341a9e5616ae2728f7c0b72da4ae1f9a01725d5a4446695599`,
igual a la preimagen literal del instalador. Los datos del destino fueron
aportados por Dot; esta tarea no consultó ninguna BD.

El ID de la forward es provisional para esta entrega; Dot debe resolver orden y
manifest de release al componer el paquete49. No se eligió release global ni se
disparó CI sobre una rama nueva. Integración en GitHub, replay, catálogo/RLS,
backend+frontend y retest GUI siguen pendientes. AUD54 global permanece abierto.

## Composición sobre selector/container y leads 52

El hook se activa con `AUD54_CI=1` únicamente en el paso de preparación del
servicio desechable de Actions, junto con `ISOLATED_QA_DB=1`. El replay local
ordinario conserva su comportamiento sin ejecutar estos 27 controles. El gate
RLS configura ambas variables y exige que el checkpoint haya sido ejecutado.
Se preservan íntegros los hooks financial49, selector148, container y leads.
La evidencia focalizada se sube tanto en éxito como en fallo.

La baseline se compone sustituyendo exclusivamente el cuerpo verificado de
`validar_cierre_embarque(uuid)` sobre la baseline vigente, nunca copiando la
baseline completa de la base histórica `2a35c130`. La forward conserva el ID
`20261009005400`, antes de `20261009010000`. La coordinación de release 53,
manifest y changelog se completa por separado junto con AUD144; este delta no
asigna una versión global ni publica o aplica la migración.
