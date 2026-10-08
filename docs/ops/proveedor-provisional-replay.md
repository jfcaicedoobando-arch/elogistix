# Proveedores provisionales: envolvente local13.824.46

Esta entrega parte de cc40a18 y conserva los diez archivos de UI199, commit
e3e26ee2 (tree bafcf460). Añade el candidato revisado de replay0013, cierre ACL
y corrección de aprobación. APP_VERSION, changelog y manifiesto corresponden
a13.824.46, con1495 migraciones verificadas en disco. Conserva íntegramente35–44,
no crea45 y no importa fuentes del paquete histórico recuperado de P&L46.

## Tres migraciones con propósitos separados

1. `20261008190000_replay_proveedor_alta_provisional.sql` es copia literal de
   Drizzle0013:5260 bytes sin newline final, SHA-256
   `d48549bb7e4a69e200919ded4fe89104cc5de7cae99ef4fa5ef1b827e3a61d5b`.
   Sólo este archivo se relaciona con0013 en `drizzle/replay.json`.
2. `20261008190100_cierre_acl_triggers_proveedor_provisional.sql` conserva los
   cuerpos originales de `_proveedor_factura_no_provisional()` y
   `_pago_proveedor_no_provisional()` y revoca ejecución directa a PUBLIC, anon y
   authenticated con RESTRICT. SHA-256
   `aafff8f8f2e91b68300bc781f43ef187a1801eb745d2877a4b4f580bb71e4cb0`.
   No añade un grant a service_role ni modifica RPC públicas, roles o triggers.
3. `20261008190200_fix_aprobar_proveedor_validacion.sql` cambia exclusivamente
   cuatro concatenaciones ambiguas de arreglos por `array_append` tipado en
   `aprobar_proveedor_provisional(uuid)`. Los faltantes deben devolver23514 y el
   mensaje ordenado, no22P02. Reemite exactamente el REVOKE PUBLIC/anon y GRANT
   authenticated originales de0013, sin añadir service_role ni otros permisos.
   SHA-256 `2c9d24ae5da46bf60d23591763719e04761f16a855c00cb44cfc58752243ab21`.

El autor y la revisión independiente comprobaron owner, ACL directa, roles,
search_path y atributos antes del harness: sólo cambia prosrc en el RPC, y la
segunda aplicación conserva el catálogo. La reafirmación de ACL requiere que el
destino corresponda al estado revisado; esa evidencia local no sustituye el
preflight remoto ni autoriza cambios en otro entorno.

Los espejos reflejan las definiciones finales. La lista service-role-only añade
sólo las dos firmas trigger ya revisadas; auditor, candado bidireccional y harness
no se relajan. Los grants amplios del harness no prueban ACL de producción.

## Baseline e identidades

Baseline estructural inicial:
`1aaf40ca840aeb5c4368642a92f814194cf9fd5894cde577e4593017ab475c0d`.
Se verificó que sólo el orden de las dos funciones RPC y sus dos grupos ACL
difería del snapshot canónico. Los cuatro bloques son byteidénticos, y retirarlos
de ambos archivos recupera exactamente el mismo resto. La versión sólo ordenada
es `9d3f6ce06c851fae81edcaf43be1638be425581b3c676da1b906261930d4bef8`.

Sobre ese orden,190200 incorpora exclusivamente las cuatro líneas aprobadas del
cuerpo. La baseline final es
`88f805966356bf00561020e3cd21025fe41c45ca383e3baf7a8d25b1ac8279da`,
idéntica a los snapshots completos fresh/forward entregados por su validador.
Las copias y evidencias anteriores quedan conservadas en el paquete local;
la revisión final debe utilizar este nuevo hash.

## Regresión funcional y gates

`supabase/tests/proveedor_provisional_approval_validation.sql` es una prueba
funcional sobre el esquema completo, registrada en `_guards_manifest.txt` para
el runner existente. Usa helpers del repositorio, identidades sintéticas y
BEGIN/ROLLBACK: ninguna conexión, ID o ruta de un cluster temporal queda fijada.
Cubre los15 subconjuntos de campos faltantes con vacíos y espacios, mensaje
exacto23514, fila completa intacta ante rechazo, las siete alternativas bancarias
válidas y aprobación repetida idempotente. No se reduce a una búsqueda textual.

La evidencia SQL separada del fix reproduce16 errores originales y120 casos
RED antes de190200, y120GREEN después, en fresh/forward y UTC/México; también
incluye28 casos de éxito/idempotencia y184 aserciones ordinarias. Son pruebas
locales del validador, no una ejecución de DB de la tarea de empaquetado ni un
resultado de CI remoto. El contrato de arquitectura conserva la inmutabilidad
0013/190000/190100 y compara el estado final de aprobación con190200.

La envolvente ejecuta sus gates estáticos sobre el árbol final. El manifiesto
se amplía sin usar el actualizador que poda a tres versiones. Un PASS de
inventario o pruebas focales no equivale a CI completo, RLS global, aplicación
remota o cierre GUI. La revisión final y el informe de SQL completo se mantienen
como evidencias separadas; no se atribuyen pruebas nuevas al mero orden de bloques.

## Base ya instalada y autorización remota

El replay190000 literal no es idempotente: una instalación que ya recibió0013
puede fallar por CHECK/triggers existentes. No se debe reaplicar a ciegas ni
ocultar drift con IF NOT EXISTS. Antes de diseñar aplicación o reconocimiento se
requiere evidencia fresca de ambos ledgers, columnas/defaults/nullability,
CHECK, cuatro funciones y atributos, owners, ACL directa/efectiva, dependencias
y eventos de triggers. Cualquier reconocimiento se revisa y autoriza por separado.

La preparación local de190100 no autoriza ejecutarla contra ninguna base remota.
Cambia seguridad persistente y requiere autorización específica del destino y
la acción, no concedida para esta fase. Tampoco se autoriza por extensión190200,
ni actualizar ledgers, aplicar migraciones, publicar Git o desplegar. No se
incluye wrapper de reconocimiento ni rollback que reabra PUBLIC tras COMMIT.
