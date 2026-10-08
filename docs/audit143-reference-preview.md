# Auditoría 143: referencias por concepto en la revisión de timbrado

## Alcance

Cambio exclusivamente de frontend sobre `003c8a7`.
La revisión previa consultaba el embarque de cabecera y prometía ese prefijo
para todos los conceptos. Edge143 ya resuelve cada origen por concepto.
La vista ahora muestra la descripción y las referencias de cada renglón,
sin reescribir descripciones guardadas, importes, datos fiscales, XML, payload,
Edge Functions ni SQL.

## Contrato respetado

Fuentes: `supabase/functions/facturapi-emitir/referenciasConceptos.ts`,
`contexto.ts`, `helpers.ts` y `_shared/referenciasEmbarque.ts`.

- Con al menos un `embarque_id` en conceptos vigentes, las referencias son
  exclusivamente las de cada origen. Una línea manual no hereda ninguna.
- Si ningún concepto tiene origen, se conserva la compatibilidad de cabecera:
  expediente y BL House del embarque con fallback nullish a los snapshots
  de la factura; BL Master únicamente del embarque.
- Una factura manual sin origen ni snapshots no recibe un prefijo inventado.
- Únicamente expediente, BL Master y BL House. No se añade Carta Porte.
- El formato de prefijo se compara en pruebas contra el helper puro de Edge.
  La pantalla muestra el prefijo, no simula la descripción completa truncada
  ni promete reproducir el XML/PDF final.

## Lecturas y estados conservadores

El hook exige que la organización activa esté resuelta y coincida con la
factura. Su clave incluye organización, factura y referencias de cabecera.
La consulta de conceptos filtra organización, factura y borrado lógico.
Los embarques se consultan en lote por IDs únicos y organización, con borrado
lógico. No hay escrituras ni consultas al PAC.

La lectura Edge de embarques puede tener mayor visibilidad y no aplica el
mismo filtro de borrado lógico. Por eso un origen ausente, invisible o fuera
de scope se muestra como **no verificable**, sin anunciar que el servidor
emitirá una referencia vacía ni reemplazarlo con la cabecera. Un error de
consulta se presenta con reintento; nunca se convierte en datos vacíos.
No se muestran resultados previos mientras se revalidan, al fallar la
revalidación ni cuando cambia la organización o la factura.

La vista es informativa. No cambia el bloqueo fiscal, la confirmación de
emisión, los defaults ni el régimen. El servidor conserva la decisión final
y vuelve a leer referencias al timbrar.

## Verificación local

- 35 pruebas focales: fusión de dos orígenes y repetidos, individual, manual
  mixto y sin origen, compatibilidad legada, ausencia, errores, scope, BLs,
  carga, reintento y descarte de datos de otra factura/organización.
- 29 pruebas de regresión fiscal existentes: defaults/confirmación del hook,
  checklist, no objeto y resumen de confirmación.
- 17 pruebas de arquitectura y contratos, todas aprobadas.
- ESLint focal sin warnings; comprobación de whitespace del diff.
- `audit:soft-delete` global reportó ocho lecturas sin filtro y una entrada
  obsoleta de baseline en archivos ajenos, sin diferencias respecto a la base
  de este cambio. Las dos consultas de esta vista sí filtran borrado lógico.
- El primer TypeScript global fue terminado con código 137 sin diagnósticos;
  se conserva el límite de 3072 MB y se realiza una única repetición serial.
  El resultado de tipos/build se entrega separado; no se presenta como aprobado
  por estas pruebas focales.

Son pruebas locales con datos sintéticos y mocks de lecturas. No certifican
RLS real, permisos remotos, publicación, emisión Sandbox, XML/PDF recién
emitidos ni render visual en navegador. La combinación con el cambio17
requiere integrar ambas entradas de `queryKeys.ts` y validar el resultado.
