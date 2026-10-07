# Release 13.824.39: devoluciones de anticipos en efectivo

Estado: paquete de código y plan de aplicación. No aplicado a un backend remoto ni publicado como frontend. No contiene un envelope ejecutable y no sustituye el preflight ni la autorización específica de SQL.

## Fuente y alcance

- Base: main38 `731f7903e82782a81391489c19cf178ee6051b81`, PR178 ya fusionado. Que esté fusionado no acredita aplicación; la autorización específica de38 sigue pendiente al preparar este documento.
- Fuente aislada131: `5ee14bb7fe421562ccd1d8dab29f549babbe9928`, dependiente de135. Su SQL coincide con la implementación original `9608719131c3a479f3a87bd0ebb58acf4365808e`, antes de cambiar el nombre forward.
- Archivo nuevo único: `supabase/migrations/20261006234200_audit131_devolucion_efectivo.sql`.
- Hash original revisado: `245f15c0d14914d5b5ef402ec81461566487ebf10335df1898a4691610b2bfa1`.
- Hash final39: `9e1d651b437aaa05a04a71dfb9b95eda35343bc32b3f9dd84f22520af292d2af`. Difiere del original sólo en tres expresiones de referencia dentro de `libro_pagos`, `pago_detalle` y `proveedor_estado_cuenta_movimientos`: las devoluciones nuevas usan su referencia explícita, incluso cuando es NULL; el fallback previo queda reservado a filas legacy sin medio registrado. Una prueba negativa reprodujo que el original mostraba la referencia del pago inicial en un reembolso nuevo en efectivo sin referencia. No se inventa ni se rellena esa referencia.
- Tres columnas opcionales nuevas en `anticipos_proveedor`: `fecha_devolucion date`, `medio_devolucion text` y `referencia_devolucion text`, sin DEFAULT ni backfill. Las filas históricas conservan NULL y sus hechos previos.
- Se sustituye la firma de seis argumentos de `devolver_anticipo_proveedor` por una sola firma de siete con `p_medio DEFAULT 'Bancario'`. Las llamadas antiguas de seis argumentos siguen resolviendo; no se conserva una sobrecarga competidora.
- Se sincronizan cuatro funciones: la RPC de devolución, libro de pagos, detalle de pago y estado de cuenta del proveedor. Efectivo no genera un abono bancario y no altera el cargo original; Bancario exige una cuenta activa, viva y de la misma organización y moneda.

No incorpora134,139,148,P&L,70,54/141 ni otras particiones. No cambia tipos de cambio, pesos, importes históricos, monedas o hechos ya registrados. La UI envía el medio y limpia la cuenta en efectivo. Requiere que el backend y su caché de esquema reconozcan la nueva firma antes de publicar esa UI.

## Historia conservada

39 lista 1.483 migraciones: exactamente38 más234200. Las entradas35,36,37,38 del manifiesto permanecen completas, y se añade39 sin ejecutar el actualizador que poda versiones. El guard existente no cambia. El changelog previo permanece íntegro detrás de la nueva entrada.

Todo SQL anterior conserva sus bytes, incluido CAS233500 (`2c67b2aa897a26816dc2fca9cc8c93118b5012ddd274eac8b12f590d0afc415b`) y cronología233700 (`8703fd2ddb3764bd5dec415ada4be55cae32fcf0568068ac21846f809ae8916f`). Se conserva el archivo histórico35, el retiro explícito de2300 y la historia disponible33–38, sin restaurar entradas que no existen en main ni reescribir las existentes.

## Preflight obligatorio para una aplicación posterior

1. Identificar el proyecto/backend exacto y el mecanismo autorizado de migraciones. Verificar37 y38 aplicadas y registradas con sus fuentes/hash exactos, además de los prerrequisitos de proformas2250/2330. Resolver38 por separado si aún está pendiente;39 no la aplica implícitamente.
2. Leer los historiales Supabase y Drizzle, sus filas/fuentes/hashes y high-water marks. Exigir ausencia de234200, del antiguo nombre213100, de otra firma131 ya instalada o del mismo SQL registrado por otro escritor. Drift, duplicación o un timestamp posterior bloquean la operación. No usar repair, reset o include-all para forzar el orden.
3. Capturar las tres columnas nuevas esperadas como ausentes, el CHECK ausente, y una sola RPC antigua de seis argumentos. Capturar sus defaults/retorno, las tres funciones consumidoras, owner, ACL canónicas, privilegios efectivos, SECURITY DEFINER, volatilidad y search_path; comparar con main38. Si el target ya tiene la firma nueva o las columnas, no repetir este SQL de transición.
4. Verificar rol de sesión y propiedad/capacidades necesarias. El DROP/CREATE de la RPC debe conservar el propietario autorizado y los privilegios efectivos; no conceder permisos ni elevar roles para hacerlo pasar. El patrón esperado permite authenticated/service_role y niega PUBLIC/anon. Los consumidores y la función de aplicación135 deben permanecer con sus atributos/ACL previos.
5. Capturar hashes del SQL final39, de los mirrors/baseline revisados y del estado previo del catálogo y ledgers. Preparar un envelope específico sólo después de ese preflight y revisarlo independientemente. Este plan no fija hashes ficticios de un target desconocido.

## Operación atómica propuesta, no ejecutada

Con autorización SQL específica y envelope ligado al preflight, una sola transacción debe:

1. Usar límites revisados de lock/sentencia/inactividad y la serialización aprobada para ambos historiales. Repetir dentro de la transacción las precondiciones de target, rol, catálogo, orden e historia.
2. Ejecutar234200 completo y exacto, sin fragmentarlo ni mezclar otras migraciones. Registrar únicamente esa migración en el mecanismo aprobado, con su fuente/hash, dentro de la misma transacción. No duplicar filas entre Supabase y Drizzle.
3. Validar las tres columnas nullable sin DEFAULT, el CHECK de medio, la firma única de siete argumentos con defaults compatibles, las cuatro definiciones finales y todos los permisos/owners/atributos esperados. Verificar que los datos históricos conservan los valores originales y que las nuevas columnas siguen NULL para ellos; no ejecutar operaciones de negocio o fixtures en el backend real.
4. Verificar que las funciones CAS37 y cronología38 y todas las filas previas de ambos historiales permanezcan intactas. Sólo confirmar si todas las postcondiciones pasan; luego volver a leer catálogo e historia desde otra transacción y comprobar la disponibilidad de la firma en la caché del API.

Cualquier error, timeout o drift aborta toda la transacción. Una respuesta de transporte incierta exige consultar catálogo/ledgers antes de cualquier reintento. La migración no es idempotente porque introduce columnas y elimina la firma vieja; no se debe reaplicar a ciegas.

## Recuperación y publicación

Antes de COMMIT, hacer ROLLBACK completo. Después de COMMIT, no borrar columnas, hechos o filas de migraciones, no restaurar a ciegas la firma vieja ni ejecutar un reset. Conservar evidencia y diseñar una nueva migración forward revisada si hace falta una corrección, considerando las nuevas devoluciones ya registradas. Ningún rollback puede convertir un efectivo real en un movimiento bancario ni borrar su historia.

La publicación del frontend es posterior y separada. Confirmar primero firma/API disponibles; después realizar sólo pruebas funcionales no productivas autorizadas. GitHub merge y CI no certifican aplicación SQL, PAC, timbrado, hosting ni pruebas GUI del ERP.
