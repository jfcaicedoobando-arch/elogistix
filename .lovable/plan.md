
# Carga de facturas mexicanas por XML CFDI en CxP

## Objetivo
Permitir subir un XML CFDI 4.0 (con PDF opcional) dentro del modal "Capturar factura". El sistema parsea el XML, usa Lovable AI para enriquecer campos ambiguos, prellena el formulario, ofrece crear el proveedor si no existe, y guarda XML+PDF en storage ligados a la factura.

## Flujo UX

Modal **"Capturar factura de proveedor"** gana una zona superior con dos modos:

```text
┌─────────────────────────────────────────────┐
│  ○ Captura manual    ● Cargar XML CFDI      │
├─────────────────────────────────────────────┤
│  [ Arrastra el XML aquí o haz clic ]        │
│  PDF (opcional): [ Adjuntar ]               │
│  [ Procesar XML ]                           │
└─────────────────────────────────────────────┘
        ↓ (al procesar)
┌─────────────────────────────────────────────┐
│ ✓ CFDI leído — UUID, RFC, Folio, Total      │
│ Proveedor: "ACME SA" (RFC ACM010101AAA)     │
│   • No existe en tu catálogo                │
│   [ Crear proveedor con datos del XML ]     │
│ Categoría sugerida por AI: "Fletes locales" │
└─────────────────────────────────────────────┘
        ↓
[ resto del formulario ya prellenado y editable ]
```

Reglas:
- XML obligatorio en modo CFDI; PDF opcional.
- Todos los campos quedan editables tras el parseo.
- Si el RFC ya existe en `proveedores` → auto-vincula. Si no, botón "Crear proveedor" abre mini-form prellenado (nombre, RFC, país=México, moneda=MXN) sin salir del modal.
- Validación: rechazar archivo no-XML, >2MB, o XML que no sea CFDI 4.0 válido.
- Guardar el UUID del CFDI en la factura para evitar duplicados (bloqueo por UUID repetido).

## Arquitectura técnica

### 1. Edge function `parse-cfdi-xml` (nueva)
- Recibe el XML como `multipart/form-data` (auth requerido).
- **Parser determinista** (sin AI) extrae del XML CFDI 4.0:
  - `UUID` (TimbreFiscalDigital), `Folio`, `Serie`, `Fecha`
  - Emisor: `Rfc`, `Nombre`, `RegimenFiscal`
  - Receptor: `Rfc`, `Nombre`
  - `SubTotal`, `Total`, `Moneda`, `TipoCambio`
  - Impuestos: suma `IVA` trasladado, `ISR`/`IVA` retenidos
  - `Conceptos[]` (descripción, importe) — primeros 10 para contexto
- **AI (Gemini Flash) sólo para campos ambiguos**:
  - Sugerir `categoria_presupuesto_id` matcheando contra las categorías activas del tenant (se pasan en el prompt).
  - Sugerir `notas` cortas resumiendo conceptos.
- Retorna JSON `{ cfdi: {...campos parseados}, ai: { categoria_id, notas } }`.

### 2. Schema cambios (migración)
Agregar a `proveedor_facturas`:
- `uuid_cfdi text` (único por organization_id cuando no es null) — para deduplicación.
- `xml_path text` — ruta en bucket `facturas`.
- `tipo_documento text` default `'manual'` con valores `'manual' | 'cfdi' | 'invoice'`.

Bucket `facturas` (ya privado) gana subcarpeta `cfdi/{org}/{uuid}.xml`.

### 3. Frontend
- Nuevo componente `CargaCfdiSection.tsx` dentro de `FacturaProveedorFormFields` (toggle modo).
- Hook `useParseCfdi()` que llama la edge function vía `supabase.functions.invoke`.
- Extensión a `useCrearFacturaProveedor` para subir XML/PDF a storage tras crear el registro.
- Si RFC no matchea: usar `useProveedorMutations.addProveedor` desde un mini-dialog "Crear proveedor del XML".

### 4. Visibilidad en la tabla de CxP
- Badge "CFDI" en la columna Folio cuando `tipo_documento='cfdi'`.
- En "Detalle de pagos": botón "Descargar XML" si existe.

## Out of scope
- Validación con SAT (verifica.facturaelectronica.sat.gob.mx).
- Carga masiva de XMLs (zip).
- Conciliación contra complementos de pago.
- Soporte CFDI 3.3 (sólo 4.0).

## Entregables
- Migración: columnas + índice único parcial por `uuid_cfdi`.
- Edge function `supabase/functions/parse-cfdi-xml/` con `index.ts`, `parser.ts` (puro, testeable), `parser_test.ts`.
- Componentes: `CargaCfdiSection.tsx`, `CrearProveedorDesdeCfdiDialog.tsx`.
- Hook: `useParseCfdi.ts`.
- Edits: `FacturaProveedorFormFields.tsx`, `DialogNuevaFacturaProveedor.tsx`, `proveedorFacturas.ts` (insert XML path + uuid), `cxpColumns.tsx` (badge CFDI), `DialogDetallePagosProveedor.tsx` (descarga XML).
- `APP_VERSION` → `12.63.0`, entrada en `CHANGELOG.md`.

