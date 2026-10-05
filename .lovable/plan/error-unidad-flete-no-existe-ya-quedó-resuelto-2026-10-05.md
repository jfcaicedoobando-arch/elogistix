# Error "unidad_flete no existe": ya quedó resuelto

## Qué pasó
Yvonne vio este error a las 16:00 (hora de CDMX). En ese momento la base todavía no tenía las columnas nuevas de tarifas: la pantalla ya pedía el dato "unidad de flete", pero la base aún no tenía dónde guardarlo.

Analogía: el formulario ya tenía la casilla impresa, pero el archivero todavía no tenía el cajón para guardarla.

Ese cambio de base se aplicó unos minutos después, con la corrección de los archivos adjuntos. Ya revisé la base y las tres columnas existen: unidad_flete, carta_garantia y solicitud_pricing_id. Es el mismo problema que ya se arregló, no un error nuevo.

## Qué hacer
1. No hace falta cambiar código ni la base.
2. Pedirle a Yvonne que recargue la página de la oportunidad (Ctrl+F5) y que adjunte otra vez el archivo.
3. Si el error vuelve a salir después de recargar, mándame el nuevo reporte para investigarlo.

## Detalles técnicos
- La consulta de `tarifas-respuesta` selecciona `costeo_tarifas.unidad_flete`. La migración `0003_pricing_respuesta_tarifas_folio_mensual` la agregó después del error (22:00Z).
- Verificado con una consulta a information_schema.
