## Objetivo

Hacer pasar `bun run test:coverage:shard --shard=1/16`. El test `architecture-baseline` reporta 2 fallas (1 import directo a Supabase y 6 archivos > 200 líneas), todas introducidas en los últimos cambios del módulo CxP.

## Cambios

### 1. Eliminar import directo a `supabase/client` en `DialogNuevaFacturaProveedor.tsx`

Mover storage + update a `src/services/cxp/proveedorFacturas.ts`:

- Nueva función `subirArchivosCfdiFactura({ facturaId, organizationId, xmlFile, pdfFile })` que sube XML/PDF a `facturas/cfdi/{org}/{facturaId}/` y actualiza `archivo_xml_url` y `archivo_pdf_url` en `proveedor_facturas`.
- Exportar desde `src/services/cxp/index.ts`.
- Nuevo hook `useSubirArchivosCfdi` en `src/hooks/cxp/useFacturasCxP.ts` (o helper directo) — usar mutación que invalida `cxp` queries.
- En `DialogNuevaFacturaProveedor.tsx` reemplazar las 3 llamadas a `supabase` por la nueva función y borrar el import de `@/integrations/supabase/client`.

### 2. Splits para bajar de 200 líneas

**`DialogNuevaFacturaProveedor.tsx` (302 → ~150)**
- Extraer hook `useNuevaFacturaProveedorForm` en `src/hooks/cxp/useNuevaFacturaProveedorForm.ts` con estado del formulario, `handleChange`, `handleProveedor`, `handleCfdiParsed`, `validate`, `reset`, `total`, `pendingCfdi`, `askCrearProv`, `submit`. Devuelve API consumida por el dialog (componente queda casi puro de render).
- Mover helpers `addDays`, `today`, `initialValues`, type `PendingCfdi` al mismo archivo de hook.

**`DialogRegistrarPagoProveedor.tsx` (272 → <200)**
- Extraer constantes y helpers (`METODOS_NACIONAL`, `METODOS_EXTRANJERO`, `metodosFor`, `defaultMetodo`, `referenciaHint`) a `src/components/cxp/pagoProveedorHelpers.ts`.
- Extraer hook `useRegistrarPagoProveedorForm` (estado + `submit`) en `src/hooks/cxp/useRegistrarPagoProveedorForm.ts`.
- Mover `Section` (es duplicado del usado en form fields) a `src/components/cxp/SectionTitle.tsx` reutilizable.

**`CxpFiltros.tsx` (245 → <200)**
- Extraer subcomponente `<CxpFiltrosSheetFields>` y barra mobile/desktop a `src/components/cxp/CxpFiltrosBar.tsx` y `src/components/cxp/CxpFiltrosSheetFields.tsx`. `CxpFiltros` queda como composición.

**`Cxp.tsx` (238 → <200)**
- Extraer `<KPICard>` y la grid de KPIs a `src/components/cxp/CxpKpiCards.tsx`.
- Extraer hook `useCxpFiltros` (estado de filtros + `hayFiltros`) o más simple: extraer la generación de PDF (`useReportePdfCartera`) y los `useState` de filtros a un sólo objeto `useCxpFiltros`.

**`FacturaProveedorFormFields.tsx` (202 → <200)**
- Mover helpers `Section`, `FieldError` y type `FacturaFormValues` a `src/components/cxp/facturaFormPrimitives.tsx` (reutilizado por hook nuevo).
- Bastará para bajar ~10 líneas.

**`useEditarEmbarqueWizard.ts` (210 → <200)**
- Extraer los 4 `useEffect` de hidratación (embarque/venta/costo/contactos/contenedores) a un hook `useHidratacionEmbarque(...)` en el mismo dominio (`src/features/embarques/hooks/`).

### 3. Verificación

- Ejecutar `bunx vitest run src/lib/__tests__/architecture-baseline.test.ts` hasta verde.
- Ejecutar la shard 1/16 completa para confirmar.

### 4. Versionado

- Bump `APP_VERSION` a `12.64.1` y entrada en `CHANGELOG.md`: "Refactor CxP — splits <200 líneas y eliminación de import directo a `@/integrations/supabase/client` en `DialogNuevaFacturaProveedor`."

## Fuera de alcance

- Resolver los warnings restantes de complexity / max-lines-per-function (no bloquean CI).
- Refactor del módulo `embarques` más allá del split mínimo de `useEditarEmbarqueWizard`.
