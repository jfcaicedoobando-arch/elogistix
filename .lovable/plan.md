# Buzón de facturas de proveedor: soporte real para PDF + XML

## El problema

Hoy el buzón trata cada archivo como un documento independiente. Un proveedor mexicano manda **dos archivos de la misma factura** (PDF y XML del CFDI), así que el operador sube dos renglones sueltos y contabilidad no sabe cuál va con cuál. Tampoco se lee nada del XML: folio, UUID, total, moneda y RFC del emisor se vuelven a teclear a mano, y el proveedor queda sin identificar.

## Qué se va a construir

### 1. Un documento = una factura (PDF + XML juntos)
- El diálogo de subida pasa a tener **dos ranuras**: "PDF de la factura" y "XML del CFDI (proveedores mexicanos)".
- Zona de arrastrar-y-soltar que acepta los dos archivos de golpe y los acomoda solo por extensión.
- Se guarda **un solo registro** con ambos archivos; en la lista se ven dos botones: `Ver PDF` y `Descargar XML`.
- Si ya existe un registro con el mismo UUID fiscal o el mismo PDF, se avisa "ya está en el buzón" en lugar de duplicar.

### 2. Lectura automática del XML
- Al seleccionar el XML se extraen: folio/serie, UUID fiscal, RFC del emisor, total, moneda y fecha.
- Esos datos se muestran para confirmar antes de enviar, y quedan guardados en el registro.
- Con el RFC se **busca el proveedor automáticamente**; si no existe, se avisa para darlo de alta (sin bloquear la subida).

### 3. Señales claras para contabilidad
- Chips por renglón: `PDF`, `XML`, y `Falta XML` cuando el proveedor es nacional y solo llegó el PDF.
- El renglón muestra proveedor, folio, total y moneda detectados, más los días en espera que ya existen.
- El buzón central (`/compras/buzon`) muestra las mismas señales y permite filtrar "sin XML".

### 4. Captura sin volver a teclear
- Desde el renglón, "Capturar" lleva a la captura de factura de proveedor **con el XML ya cargado**, reutilizando el parser CFDI existente (mismo camino que hoy usa `CargaCfdiSection`), y con el embarque y proveedor prellenados.
- Si el proveedor es internacional y solo hay PDF, "Capturar" abre la ruta de PDF con IA que ya existe.

### 5. Checklist de cierre
- La regla de cierre pasa a exigir, para proveedores nacionales, que el documento tenga XML además de PDF; hoy solo cuenta que exista un archivo.

## Detalles técnicos

- **Migración** en `public.embarque_facturas_entrantes`: nuevas columnas `xml_path`, `xml_nombre`, `xml_hash`, `uuid_fiscal`, `rfc_emisor`, `folio_serie`, `fecha_emision`; índice único parcial `(organization_id, uuid_fiscal) WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL`. Sin cambios de RLS (mismas políticas por tenant); se conservan `GRANT` actuales.
- **Dominio** (`src/lib/domain/facturasEntrantes.ts`): helpers puros nuevos — clasificar archivos por extensión, emparejar PDF/XML, `faltaXml(proveedorEsNacional, tieneXml)`, ruta de storage para el XML. Todo con tests unitarios.
- **Lectura del XML**: extracción de metadatos en el cliente con `DOMParser` (solo el nodo `Comprobante`/`TimbreFiscalDigital`), sin llamar a la Edge Function en la subida; los importes pasan por `parseImporteFiscal` de `src/lib/domain/facturaConceptos.ts`.
- **Servicios** (`src/features/cxp/services/facturasEntrantes.ts`): `subirFacturaEntrante` acepta `{ pdf, xml }`, sube ambos al bucket `cxp-inbox` y hace un solo insert; `abrirFacturaEntrante` recibe cuál de los dos archivos abrir.
- **UI**: `SubirFacturaEntranteDialog.tsx` sobre `FormDialogShell`/`FormDialogSection` (dos secciones: Archivos y Datos detectados); el renglón de la lista se extrae a `FacturaEntranteRow.tsx` para respetar el límite de 200 líneas por archivo.
- **Cierre**: ajuste en `src/features/embarques/utils/cierreCheckMeta.ts` y su test.
- Registro en `CHANGELOG.md` y bump de `APP_VERSION`.

## Compatibilidad

Los registros ya existentes siguen funcionando: se leen como "solo PDF" (o "solo XML") y se pueden completar subiendo el archivo faltante sin crear un renglón nuevo.
