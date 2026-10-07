# Auditorías 62/130: Por capturar

## Contrato

La bandeja mide base fiscal capturada frente al presupuesto en la misma moneda.
No es saldo por pagar ni costo neto del P&L. Conserva los estados de captura,
incluido Borrador, y excluye Cancelada y borrados de monto, conteo y fechas.
NC y pagos no deshacen la captura. Los importes permanecen en la moneda de la
factura; un vínculo MXN/USD no autoriza sumar nominales ni convertir al T/C actual.

Las asignaciones positivas efectivas determinan pertenencia: monto unitario
positivo por cantidad positiva, con el fallback histórico NULL/0→1. Se excluyen
costos borrados y ajustes de factura. Se agrupan por factura/embarque antes de
contar. No se vuelven a sumar renglones fiscales. El residuo parcial queda sin
asignar y el exceso se limita proporcionalmente al subtotal fiscal. La cabecera
se usa sólo cuando no hay asignaciones efectivas. Una factura de base cero sigue
capturada y cuenta una vez en cada embarque con asignación efectiva, con importe
cero, sin división por cero. Todas las relaciones exigen la misma organización.

No existe helper común de reparto. La regla coincide con el contrato de
124/130/139 sin depender de ni modificar los cálculos de P&L/cierre. La RPC
conserva firma, SECURITY INVOKER, owner, ACL y límite de 500; no reescribe datos.
Presupuesto y captura se agregan con NUMERIC sin redondear cada vínculo. La UI
usa el redondeo monetario canónico al comparar y mostrar sus centavos, evitando
excesos de 0.00 por flotantes y sin aplicar tolerancia a un centavo faltante.

## Casos originales

- FP13: presupuesto 1000, base 1000 e IVA 160 → 1000/1000, 100%, sin sobrecosto de 160.
- FP23 sin cabecera: asignaciones 40/100 → ELNAC17 recibe 100/120.44 y una factura.
- ELNAC16: FP21 base 60 más asignación 40 → 100/100 y dos facturas. Se conserva su
  ajuste histórico −40 y presupuesto 100.

## Cobertura y límites

`supabase/tests/audit62_130_cxp_por_capturar.sql` reproduce esos tres casos con
fixtures sintéticos en una transacción revertida. Cubre cabecera ajena/duplicada,
parcial/exceso, cantidad fraccionaria/negativa/cero, base cero, precisión,
borrado/cancelación, NC aplicada, cambio de FX, monedas separadas, conteo/fecha,
organización cruzada, ACL e invariancia de asignaciones. Los tests de UI verifican
los tres resultados, redondeo canónico y filtros; los tests existentes preservan
la separación MXN/USD y el enriquecimiento de referencias.

La firma histórica sólo expone columnas MXN/USD. Esta corrección no añade EUR
a la interfaz ni cambia ese contrato; es una limitación anterior y separada.
No se probaron escrituras fiscales ni remotas. No se ejecutaron pruebas de la auditoría 144.

## Validación local (2026-10-07)

- PostgreSQL 17.9 aislado: replay completo del squash y 285 migraciones adicionales.
- RPC anterior: fallo reproducido en 1000 esperados frente a 1160 capturados.
- RPC nueva: 27 comprobaciones de monto/conteo/fecha/presupuesto, más pertenencia,
  integridad de vínculos y permisos. Verde tras dos aplicaciones consecutivas y
  otra vez bajo el post-migrate de CI.
- Owner y ACL completos idénticos antes/después de reemitir la función. El permiso
  PUBLIC EXECUTE histórico no cambia; SECURITY INVOKER y permisos/RLS de tablas
  impiden lectura de datos por anon.
- Helpers de CI, RLS isolation y anon_deny_all: verdes. Las primeras ejecuciones
  ajustaron fixtures para usar cancelar_factura_proveedor y restore_record, y el
  harness estándar de CI antes de las suites RLS; no se cambiaron esas guardias.
- Baseline regenerada desde PostgreSQL: sólo cambia el cuerpo de esta RPC.
- 24 pruebas frontend, ESLint de archivos afectados, audit:migrations,
  audit:schema-functions, audit:replay-mirror, audit:rpc-sync y audit:schema:
  verdes. Las dos divergencias espejo previas siguen intactas. El estado actual
  de audit:manifest se detalla abajo, tras la revisión de integración.
- Tipos app/node con máximo 3 GB, guardia de integridad y comparación exacta de
  baseline contra otro snapshot: verdes.
- audit:rpc-columns: falla con seis referencias en funciones ajenas al delta:
  _embarque_aplicar_tarifa_decidida, crm_reporte_datos y
  _venta_facturada_por_embarque. Con la RPC de captura anterior y con la nueva,
  el log es idéntico byte a byte y ambos terminan en 1; no hay hallazgos en
  cxp_por_capturar. No se modifican esas fuentes ni su allow-list.
- No se ejecutó build pesado, suite completa ni GUI de producción.

## Ajuste de integración tras revisión

La suite audit62_130_cxp_por_capturar.sql queda registrada exactamente una vez en
_guards_manifest.txt, que consume el runner oficial scripts/ci/run-guards.sh.
Así sus 27 comprobaciones de captura participan en el job rls-guards de CI.
No se modifica la suite, el runner ni sus reglas de bloqueo.

La entrada histórica 13.824.34 de migration-manifest.json se restaura exactamente
a la base 5daa8a9. No se añade la migración nueva a una versión histórica. La
futura versión de publicación debe incorporar 20261007001000_audit62_130_cxp_captura_base.sql
en su propia entrada, junto con el resto del SQL aprobado para ese release.
Hasta preparar esa entrada, audit:manifest queda pendiente y falla por esa
migración faltante en la versión actual. Este delta local no habilita publicación.

Validación del ajuste: guard de registro (3 tests) y 24 pruebas focales frontend,
27 tests en verde. La suite SQL registrada se ejecutó con el runner oficial y
un manifiesto filtrado desde la entrada real: 1/1 guard verde, sin ejecutar otras
suites. El archivo completo de migration-manifest.json coincide byte a byte con
5daa8a9 y audit:manifest falla exclusivamente por el SQL nuevo aún no publicado.

## Empaquetado posterior: 13.824.41

El estado de manifest pendiente descrito arriba corresponde al checkpoint fuente
`cee417a`. El paquete41 lo resuelve añadiendo una entrada nueva y completa, sin
modificar35–40, sobre el commit40 `c87a4229af9a5c269a048374d9c5cf3f17ec3821`.
El cuerpo de la función y la suite se conservan byte a byte. El forward desde40
detectó un GRANT explícito service_role redundante en la fuente;41 lo omite del
SQL/espejo para preservar la ACL completa. La comparación histórica de ACL
mostrada arriba no comprobaba esta transición desde40. Ver el plan
`audit62-130-release41-application-plan.md` para dependencias, alcance y validación.
