## Objetivo
Que en el modal **"Detalle de factura de proveedor"** se vea si la factura tiene XML y/o PDF adjuntos, y permitir abrirlos.

## Estado actual
- `cfdiStorage.ts` ya guarda los paths en `proveedor_facturas.archivo_xml_url` / `archivo_pdf_url`.
- Pero el SELECT `PROVEEDOR_FACTURAS_SELECT` **no los trae**, así que `FacturaCxP` no los expone y el modal no los muestra.
- Ya existe `getFacturaSignedUrl` / `openFacturaInNewTab` en `src/services/storage/facturas.ts` para abrir archivos del bucket privado `facturas`.

## Cambios

### 1. Exponer los campos en el tipo y el fetch
`src/features/cxp/services/proveedorFacturas.helpers.ts`:
- Añadir `archivo_xml_url, archivo_pdf_url` a `PROVEEDOR_FACTURAS_SELECT`.
- Añadirlos al `Pick<ProveedorFacturaRow,...>` del tipo `Joined`.
- En `mapJoinedRow`, mapearlos al `FacturaCxP`.

`src/features/cxp/services/proveedorFacturas.ts`:
- Agregar `archivo_xml_url: string | null` y `archivo_pdf_url: string | null` a la interfaz `FacturaCxP`.

### 2. UI en el modal
`src/features/cxp/components/InfoFacturaSection.tsx`: agregar al final (antes de Notas) un bloque **"CFDI adjuntos"** con dos filas:

- **XML**: si hay `archivo_xml_url` → badge verde "Adjunto" + botón "Abrir" (ícono `FileCode`). Si no → badge gris "No adjunto".
- **PDF**: idem con ícono `FileText`.

El botón "Abrir" llama a `openFacturaInNewTab(path)` (helper ya existente). En error, `notifyError` con `method: "FEATURES_CXP_INFOFACTURA_OPEN_CFDI"`.

### 3. Test
`src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` (extender si existe, o nuevo): verificar que `mapJoinedRow` propaga `archivo_xml_url` / `archivo_pdf_url`.

### 4. Versionado
- `APP_VERSION` → `13.114.15`.
- Entrada en `CHANGELOG.md` describiendo el agregado al modal.

## Archivos a editar/crear
- `src/features/cxp/services/proveedorFacturas.ts`
- `src/features/cxp/services/proveedorFacturas.helpers.ts`
- `src/features/cxp/components/InfoFacturaSection.tsx`
- `src/features/cxp/services/__tests__/proveedorFacturas.helpers.test.ts` (nuevo o extender)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

No requiere migración de base de datos.
