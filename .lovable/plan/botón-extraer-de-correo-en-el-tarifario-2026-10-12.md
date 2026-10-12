# Botón «Extraer de correo» en el Tarifario

## Respuesta corta: sí hay una mejor forma
El script actual tiene tres problemas para usarse dentro de la plataforma:
- Pide la **contraseña del correo** escrita en el código (riesgo de seguridad).
- Corre en una computadora, genera un CSV y luego hay que subirlo a mano.
- Varios datos van fijos o adivinados: Golden siempre pone vigencia «1-7/Sep», origen «Base Ports» y «21 days»; si el proveedor cambia la semana, el dato sale mal.

La propuesta: conectar el buzón de Pricing (Gmail de elogistix) de forma segura y que el Tarifario tenga un botón **«Extraer de correo»** que lea los correos recientes de los 4 proveedores, muestre una vista previa y, al confirmar, cree las tarifas en el mismo flujo que ya usa «Importar tarifas» (entran en borrador hasta aprobarse, como hoy).

Analogía: en vez de darle la llave de tu casa a un mensajero (contraseña en el script), le das un pase de visitante que sólo abre el buzón y que puedes revocar.

## Qué vas a ver
1. En Tarifario → pestaña Tarifas, junto a «Importar», un botón **Extraer de correo** (sólo Pricing/administradores).
2. Al pulsarlo busca correos de los últimos 20 días de: longsailing.net (LONGSAIL), szgolden-shipping.com (GOLDEN), oriental-log.com (ORIENTAL), rainbowell.com (RAINBOW).
3. Muestra una tabla de vista previa: Origen, Destino, Agente, Naviera, 20", 40", Inicio y Término de vigencia, Días libres, correo de donde salió, y los renglones con error (por ejemplo puerto o naviera no dados de alta).
4. Botón **Importar N tarifa(s)**. Si una tarifa idéntica (misma ruta, agente, naviera, contenedor y vigencia) ya existe, se omite para no duplicar.

## Qué se extrae de cada proveedor (sólo lo indicado)
- **GOLDEN**: sólo la tabla con encabezado MANZANILLO/LAZARO y ENSENADA (SSL, POL, 20GP, 40GP&40HQ, Free time, Valid). Se leen los dos destinos; «/» se ignora. Vigencia y días libres se toman de las celdas «Valid» y «Free time», no fijos. Las demás tablas del correo se ignoran.
- **ORIENTAL**: bloques de texto numerados (POL, POD, Rate USD a/b; 20GP/40HQ, Carrier, days free time, Validity from … till …). Varias navieras en un bloque (COSCO/OOCL) generan una tarifa por naviera; varios POL generan una por puerto. El recargo «+USD150/150 Xingang/Dalian/Xiamen» se suma a esos puertos.
- **LONGSAIL**: la tabla «Manzanillo, MX / Lazaro Cardenas, MX» con columnas por naviera (W', I', Z', T', MSK, etc.), filas por POL, fila Free time y fila Valid. «/» se ignora.
- **RAINBOW**: sólo el texto que empieza con MANZANILLO/LAZARO CARDENAS/ENSENADA (líneas NAVIERA:USD 20/40/40HC y Validity). La tabla de «space on hand» de abajo se ignora. Cuando la línea trae precio distinto por destino (YML Manzanillo+Ensenada vs Lázaro Cárdenas), se generan tarifas separadas.

## Preguntas que necesito confirmar antes de construir
1. **Origen «Base Ports»** (Golden): ¿a qué puertos de China equivale? (¿Shanghai, Ningbo, Shenzhen, Qingdao…?) para crear una tarifa por puerto.
2. **Códigos de naviera de Longsail** (W', I', Z', T', MS', C', Y', E', O'…): ¿a qué naviera corresponde cada letra? Propongo guardar esa equivalencia en una tabla editable dentro del extractor.
3. **Fila «30»** de Longsail: ¿qué puerto es (Qingdao)?
4. ¿Las tarifas extraídas deben quedar en **borrador para aprobación** (como la importación actual) o vigentes directo?

## Límites
- Todavía no pude leer los correos reales: el buzón de Pricing no está conectado a esta conversación. El primer paso de construcción es conectarlo y probar los 4 lectores con correos reales en sólo lectura.
- Si un proveedor cambia el formato del correo, ese proveedor mostrará errores en la vista previa en lugar de cargar datos incorrectos.
- No se envían correos, no se marcan como leídos ni se borran.

## Detalles técnicos
- Conectar Gmail como conector de la app (cuenta del buzón de Pricing, permiso sólo lectura `gmail.readonly`); no hay contraseña en el código.
- Nueva función de servidor `tarifario-extraer-correos`: valida sesión y rol `_crm_es_pricing`, busca con `q=from:(longsailing.net OR szgolden-shipping.com OR oriental-log.com OR rainbowell.com) newer_than:20d`, lee los cuerpos en lote (`format=full`), y ejecuta 4 lectores en TypeScript (port del script, con BeautifulSoup→parser HTML de Deno). Devuelve filas en el mismo formato de columnas de «Descargar Excel»; no escribe en la base.
- El cliente reutiliza `prepararImportacion` + `insertTarifaConRecargos` de `ImportarTarifasDialog` (mismas validaciones, creación de rutas faltantes y borrador). Deduplicación contra tarifas existentes antes de insertar. Sin tablas ni migraciones nuevas, salvo la equivalencia de navieras de Longsail si se decide guardarla (pregunta 2; alternativa: constante en código).
- Lectores con pruebas unitarias usando cuerpos de correo de ejemplo (sin datos personales). Archivos ≤200 líneas. Validación focalizada; CI/RLS completos en GitHub Actions. Sin cambio de versión salvo autorización.
- También se puede entregar el script de Python corregido (lectura de Valid/Free time reales, Ensenada, multi-naviera, recargos, Rainbow sólo el bloque de texto) si se quiere seguir usando fuera de la plataforma.
