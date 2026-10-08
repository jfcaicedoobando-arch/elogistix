# Release 13.824.40: importes de aplicaciones congelados

Estado: paquete de código para revisión. No aplicado a un backend remoto ni publicado como frontend. No es un envelope ejecutable ni sustituye un preflight ligado al backend real.

## Fuente, composición y dependencias

- Main exacto: `003c8a7f4306e1f3ea0d7633985c496690b9e4b4`, con release 38, diseño PDF 182 y copy 183 conservados.
- Prerrequisito 39 corregido: commit `22e65c29a2ed2ab4bab45c7253e31367975e883e`, posterior a `fb33799`, preservando referencias de devolución en libro de pagos, detalle y proyección final del estado de cuenta. El SQL 131 SHA-256 es `9e1d651b437aaa05a04a71dfb9b95eda35343bc32b3f9dd84f22520af292d2af`. Su composición final con main 003c es el commit `3951f5c5693344ec6895ad599ba409c1abd9ec38`, árbol `14d03afcb198c44e7556971388304c541bad1fd7`, padre directo del paquete 40 corregido.
- Fuente 134: delta exclusivo `5ee14bb..d95b8e7a6fd86cdbfa298f6743ae9daffe6db12f`, con la corrección CxC revisada, más una sola expresión CASE que preserva la referencia corregida de 39. SQL único nuevo `20261006235700_audit134_pago_congelado.sql`, SHA-256 final `9bcbbf4166368dc95f1a7e64290658001af59a81ca27ca10164e443a2b6480a2`. El hash original `9d0fea4d796f95bb72ecd6d88694164c00d4c0a670b8cc0fe9c27453329d30b6` queda sólo como procedencia histórica; no es el payload final.
- Orden requerido: CAS 37 → cronología 38 → devolución 39 → conversión 40. Que estén empaquetadas o fusionadas no prueba su aplicación. La aplicación 38 sigue siendo una dependencia no certificada por este paquete.
- No incluye 139, 148, P&L ni los cambios independientes de aging/por pagar 70. El cierre conserva membresía y agregación previas, además de NC de clientes Timbrada/Aplicada; las NC de proveedores siguen sólo Aplicada.

El único solapamiento de funciones entre 39 y 40 es `proveedor_estado_cuenta_movimientos`. Se conservan su metadata de devolución y el CASE final de referencia corregido en 39; cambia la selección/reclasificación del pago conforme 134. Una devolución nueva con referencia NULL permanece NULL aun si el anticipo original tuvo referencia bancaria; los históricos sin medio conocido retienen su fallback. No se reemplazan `libro_pagos`, `pago_detalle`, `devolver_anticipo_proveedor` ni `aplicar_anticipo_a_factura`. La lista 40 añade únicamente 235700 a 39. Las entradas históricas 35–39 quedan completas, sin usar el actualizador que las poda.

## Contrato y límite histórico

El helper puro usa `monto_en_moneda_factura` para aplicaciones, incluido cero. NULL sigue desconocido aun con una paridad separada disponible. Los pagos directos conservan el convertidor previo. Una aplicación cruzada conocida genera dos renglones contables, no un movimiento bancario; si falta la conversión no se inventa ningún lado. El saldo expone `flujo_incompleto` y el cierre permanece bloqueado por conversión desconocida, aunque la suma de importes conocidos dé residual cero.

No se actualizan tablas de negocio, no se reconstruyen datos históricos y no se cambia la membresía del cierre. Las restricciones vigentes impiden fabricar nuevas aplicaciones con importe congelado NULL; esa forma histórica se verifica con el helper y guardas de consumidores, sin desactivar triggers ni constraints para crearla. Los fixtures ordinarios locales usan RPCs y rollback.

## Preflight obligatorio para una aplicación futura

1. Identificar proyecto/backend y mecanismo autorizado. Comparar los historiales Supabase y Drizzle, sus fuentes/hashes, duplicados y high-water marks. Exigir 37, 38 y 39 aplicadas con los bytes revisados; verificar ausencia de 235700 y de cualquier implementación 134 instalada con otro nombre. No usar reset, repair o include-all para forzar el orden.
2. Capturar las tres funciones consumidoras vigentes, sus firmas/defaults/retornos, owners, ACL canónicas y privilegios efectivos, SECURITY DEFINER, volatilidad y search_path. Comparar contra el catálogo 39 revisado. El helper nuevo debe estar ausente. Si un consumidor avanzó a 139 u otra implementación posterior, detener y reconciliar; no sobrescribirlo con este snapshot.
3. Verificar rol y capacidades autorizadas. El helper nuevo es IMMUTABLE, SECURITY INVOKER, sin acceso a tablas, con EXECUTE sólo para authenticated/service_role (PUBLIC/anon denegados). Los consumidores existentes deben conservar permisos y atributos. No elevar roles ni ampliar permisos persistentes para resolver un fallo.
4. Capturar hashes del SQL/mirrors/baseline final, definiciones protegidas 37/38/39 y estado previo de ambos historiales. Preparar y revisar independientemente un envelope específico, sin inventar hashes de un target no inspeccionado.

## Operación atómica propuesta, no ejecutada

Con autorización SQL específica y envelope ligado al preflight, una sola transacción con límites revisados de lock/sentencia/inactividad y serialización de historiales debe repetir las precondiciones, ejecutar 235700 completo y exacto, registrar sólo esa migración en el mecanismo aprobado y verificar todas las postcondiciones antes de COMMIT.

La verificación debe demostrar las cuatro definiciones nuevas/finales y sus atributos, preservación de los demás objetos/owners/ACL, ausencia de backfill y conservación byte a byte de filas históricas y ledgers previos. Los pagos históricos no se modifican para conseguir que cuadre el saldo. No ejecutar fixtures ni operaciones de negocio sobre el backend real. Tras COMMIT, releer catálogo e historia desde otra transacción y verificar exposición de la firma donde corresponda.

Drift, duplicación, permisos inesperados o timeout abortan toda la transacción. Ante respuesta de transporte incierta, consultar catálogo e historiales antes de reintentar. Aunque las funciones usan CREATE OR REPLACE, eso no permite registrar o aplicar dos veces el paquete sin preflight.

## Recuperación y publicación

Antes de COMMIT, ROLLBACK completo. Después, conservar evidencia y preparar una nueva corrección forward revisada si hace falta; no borrar hechos, modificar ledgers ni restaurar una definición vieja a ciegas. La publicación del frontend y cualquier validación GUI/Sandbox son pasos posteriores separados. Merge/CI no prueban backend actualizado, PAC, timbrado, hosting ni cierre de los 150.

## Validación local del paquete

La composición se compara contra el 39 corregido 3951f5c. Respecto a ese prerrequisito, las 1483 migraciones anteriores, los manifiestos 35–39, los tipos 39 y sus referencias permanecen intactos. Respecto al anterior 40/45577b9, sólo cambian una expresión en SQL 131 y la misma expresión en SQL 134; el resto del SQL 134 permanece idéntico. El orden canónico del helper/ACL en baseline se conserva. El control negativo instaló el antiguo 134 sobre el 39 corregido y reprodujo exactamente la referencia ORIGINAL-BANK-REF filtrada a una nueva devolución Efectivo con NULL; restaurar el 134 final dejó el baseline íntegro y todas las suites verdes.

PostgreSQL 17.9 local: replay limpio 40 con 290 migraciones posteriores al squash y una migración puntual de datos omitida por el inventario del repositorio; snapshot completo idéntico al baseline; 191/191 guardas y 49/49 suites RLS. Nueve suites ordinarias incluyen aplicaciones MXN/USD/EUR, cambio posterior de DOF, cero conocido y NULL desconocido (117 combinaciones puras más casos históricos y guardas de consumidores), ambas piernas del cruce, reversión, idempotencia, compatibilidad de pago directo y aislamiento. Las suites de reclasificación, consistencia y devolución pasan también en UTC y America/Mexico_City.

El forward 39→40 converge al catálogo y snapshot del replay limpio antes de los GRANT generales de CI. Conserva todos los atributos, propietarios y privilegios efectivos de 665 funciones existentes; sólo cambian los cuerpos de los tres consumidores y se añade el helper puro con su whitelist prevista. Todas las filas de tablas públicas, incluido el fixture de devolución histórica sin metadatos nuevos, permanecen idénticas antes y después. Cinco suites ordinarias adicionales pasan sobre ese forward.

Las pruebas frontend focalizadas suman 84 casos en 14 archivos, incluidos los 8 casos del selector N2 exacto y sus aserciones contables intactas, más las regresiones de prerrequisitos y consumidores del estado de cuenta. El helper no se consume desde TypeScript: no se generan tipos ni se altera una firma frontend en 40. Node types y build minificado serial pasan nuevamente sobre la corrección; el build termina en 1 min 11 s con Terser limitado a un worker, heap máximo 3072 MB y sourcemaps desactivados. También pasan presupuesto del bundle (entrada 207 KB gzip, límite 365 KB), política de sourcemaps y licencia PDF. La revalidación completa de tipos app quedó limitada por memoria: SIGKILL con heap 3072 MB y JavaScript heap out of memory con 2304 MB, sin diagnóstico de error de tipos. No se presenta ese intento como PASS. La fuente productiva TypeScript, tipos generados, configuración y dependencias permanecen idénticos al 40/45577b9 previamente aprobado; el único cambio TS heredado de 39 es el test N2. Ese archivo pasa un typecheck aislado con las opciones estrictas de app y el contexto ambiental Node que usa el test, además de sus ocho pruebas; esto no sustituye el typecheck completo. El typecheck app completo debe resolverse en CI antes del cierre de publicación. El build inicial del paquete anterior y sus logs se conservan como procedencia, sin sustituir este nuevo resultado.

Límites: no se ejecutó la suite frontend completa, ni navegador/GUI, backend remoto, CI remoto, PAC, despliegue o aplicación de migraciones en el proyecto Lovable. El ensayo de forward es local y no certifica los historiales de un backend desconocido.

## Recomposición local sobre main2538 y replay0010

Este candidato recompone el delta revisado `c87a4229af9a5c269a048374d9c5cf3f17ec3821` sobre el padre `32912a4fb8f3cd99af5c20644ee80b0b1b9986fa`. Conserva el release39 revisado `32912a4fb8f3cd99af5c20644ee80b0b1b9986fa`, el replay Drizzle0010, su forward restrictivo234100 y los cambios CRM/Costeo heredados. Los manifiestos históricos35–39 permanecen iguales al nuevo39; sólo se actualiza la entrada inédita40 para incluir el inventario real. El SQL propio del paquete conserva sus bytes y SHA-256 de la fuente. Las validaciones descritas arriba pertenecen a la fuente histórica y no certifican esta nueva composición; la validación conjunta de la cadena se registra por separado. No se aplicó SQL remoto, no se publicó frontend y no se actualizó ningún PR.
