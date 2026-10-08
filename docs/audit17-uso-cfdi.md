# Auditoría 17: uso CFDI en nuevas facturas de ingreso

## Alcance

La emisión de una factura tipo I valida el uso solicitado antes de reservar el claim o llamar al PAC. La UI y la edge reutilizan `supabase/functions/_shared/usoCfdiFiscal.ts`, con reexport al frontend. El RFC del snapshot de la factura prevalece sobre el del cliente tanto en el resumen y los checks como en el contexto que construye el payload.

Las reglas son independientes:

- Compatibilidad uso/régimen del catálogo de uso CFDI.
- Deducciones personales D01–D10 sólo para persona física (RFC de 13 posiciones).
- Los RFC genéricos nacional y extranjero requieren régimen 616.
- El flujo de ingreso no ofrece ni acepta CP01, CN01 o P01.

El uso G03 no es compatible con 616, sea el RFC genérico o individual. S01 sí está permitido para 616. Esto no identifica ni convierte el comprobante en factura global: no se agrega InformaciónGlobal ni se infiere ese carácter por tener RFC genérico.

## Selección y confirmación

La ruta Nueva factura manual → Crear y timbrar aplica la misma compatibilidad en el formulario y vuelve a leer los datos fiscales del cliente antes de crear el borrador. Usa el RFC que se guardará en la factura, no otro RFC del catálogo. Guardar borrador permite completar datos fiscales después. Tanto la emisión manual como el diálogo normal muestran el resultado solicitado/efectivo del XML.

Una selección heredada inválida continúa visible con un motivo específico. No se cambia por S01 ni por otra clave sin selección del operador. El cambio de régimen recalcula opciones y bloqueos. Una respuesta tardía de defaults no sustituye un uso editado durante esa apertura. Cerrar/reabrir o cambiar de factura restaura el valor persistido; el handler de confirmación ejecuta de nuevo los checks antes de guardar datos o solicitar el timbrado.

## Captura de uso en la configuración del borrador

La pestaña editable conserva su contenido después de visitarla, oculto e inaccesible cuando se navega a otra pestaña. No se monta por abrir directamente otra sección. Su estado se aísla por factura y empresa: cambiar de documento no reutiliza la captura anterior.

El autosave conserva el debounce de 500 ms y no guarda desde cleanup. Sólo incluye campos editados; la hidratación de campos intactos al volver a una factura no crea escrituras. Cambios que normalizan al mismo patch (por ejemplo, espacios finales en notas) conservan el timer original. Desmontar antes de enviar cancela la captura pendiente; una escritura ya enviada se reconcilia sobre su destino original, sin presentarla como abortada. La cola permanece sólo en memoria y no se persiste entre sesiones. Las escrituras se serializan por factura/empresa y una respuesta anterior no marca como guardada una selección posterior. El error identifica su factura y no cambia el indicador de otra.

Cada captura conserva el scope de autenticación propietario del formulario. Se verifica antes del envío y se descartan efectos secundarios de respuestas de otro usuario, rol, empresa o generación; la bitácora vuelve a verificarlo después de leer sesión. Si se vuelve mientras otra instancia aún guarda, la instancia nueva consulta su detalle con su propio scope en la misma cola después de la petición anterior, antes de cualquier escritura posterior, sin transferirle la sesión nueva. La consulta de autosave y su bitácora reciben la empresa capturada (parámetro existente). La escritura filtra también empresa, estado Borrador/Por timbrar, papelera, UUID y claim. Cero filas actualizadas es conflicto, no éxito. El resultado confirmado sólo se refleja en una caché del mismo borrador/empresa; nunca reemplaza el uso de un CFDI ya emitido. El diálogo de timbrado espera a que esa captura termine, se refresque su detalle y el formulario adopte el valor confirmado, incluido el intervalo de debounce. Un error de guardado también bloquea la emisión del valor anterior; la card conserva la selección y ofrece reintentar explícitamente. Cerrar/desmontar descarta sólo capturas aún no enviadas, nunca simula deshacer una escritura confirmada. La lectura de retorno también mantiene bloqueado Timbrar hasta conciliarse, o reintentarse si falla. No se añaden RPC, migraciones ni llamadas al PAC.

Límite preexistente fuera de este delta: el handler de confirmación explícita conserva su secuencia `await actualizarDatos → timbrar` sin un scope de sesión propio. Las guardas descritas cubren la captura y reconciliación de autosave, no toda la emisión si cambia la sesión durante aquel guardado explícito. Ese flujo requiere una revisión separada.

## Resultado ya timbrado

Los campos opcionales `uso_cfdi_solicitado`, `uso_cfdi_efectivo` y `fuente_uso_cfdi` amplían la respuesta de éxito. El efectivo se informa únicamente si se pudo leer el XML del mismo UUID. Si el XML difiere del solicitado, la UI muestra ambos como una emisión exitosa. No ofrece reintentar ni reemitir.

El valor solicitado sólo se aprende como preferencia cuando coincide con el XML y sigue siendo compatible con el receptor cliente. Sin XML o con diferencia se conservan únicamente las preferencias de forma/método de pago, sin actualizar uso. Esto limita la escritura de una preferencia explícita; no elimina las sugerencias históricas. Si no hay preferencia explícita, `obtener_defaults_facturacion_cliente` conserva su fallback al último comprobante: su uso efectivo puede sugerirse y se valida antes de emitir. La selección del borrador prevalece; después se prioriza la preferencia explícita consultada del cliente sobre un resumen RPC que podría estar cacheado. Una sugerencia válida del último XML es admisible; una incompatible permanece visible y bloqueada. No se modifica el RPC ni su esquema. Las respuestas antiguas, pendientes y de REP siguen admitidas. Metadatos opcionales malformados se omiten y nunca convierten un timbre confirmado en un error.

Se conservan la persistencia existente (XML primero y respuesta del proveedor como respaldo), el compare-and-set del claim, idempotencia, recuperación y webhook. Las reglas nuevas no se ejecutan sobre documentos ya emitidos o recuperados ni alteran el lector histórico del XML, notas de crédito o REP. No hay migraciones ni cambios retroactivos de preferencias.

## Fuentes consultadas el 2026-10-07

- [Facturapi, referencia API, tabla Uso CFDI](https://docs.facturapi.io/api/): grupos G01–G03/I01–I08, D01–D10, S01 y sus regímenes compatibles.
- [SAT, Anexo 20, páginas impresas 76–77](https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175118249&ssbinary=true): compatibilidad de UsoCFDI con persona/régimen y regla RFC genérico → 616.

Este preflight no es un validador fiscal integral. No implementa el cruce completo régimen/persona del catálogo c_RegimenFiscal porque no se verificó su tabla completa en esta auditoría. No valida aquí inscripción SAT, nombre fiscal, domicilio genérico/lugar de expedición ni requisitos de factura global. Estas limitaciones no justifican sustituir silenciosamente ningún uso.

## Verificación local

Los tests cubren 616/G03 genérico e individual, genérico616S01, moral601G03, física605D01, incompatibilidad de persona, genérico en otro régimen, CP01/CN01/P01, selección heredada/cambio de régimen/cierre/reapertura/cambio de factura, RFC snapshot, bloqueo antes del claim y del PAC, resultado XML distinto, preferencias sin XML, contrato anterior/REP, persistencia, recuperación, idempotencia y webhook. No se emite contra PAC ni se ejecuta SQL remoto para probar este cambio.
