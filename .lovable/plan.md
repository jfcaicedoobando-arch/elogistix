Ahora mismo no hay lugar para subir el XML de una nota de crédito de proveedor: `proveedor_notas_credito` solo almacena folio, fecha, monto y motivo; el registro es 100% manual. El plan agrega carga automática desde XML CFDI, reutilizando la infraestructura que ya existe para facturas de proveedor.

### Objetivo
Permitir subir el XML de la nota de crédito de un proveedor mexicano, parsear los datos automáticamente y adjuntar el XML/PDF al registro, igual que con las facturas de proveedor.

### Cambios propuestos

#### 1. Base de datos

- Agregar a `public.proveedor_notas_credito`:
  - `archivo_xml_url text` (path en storage)
  - `archivo_pdf_url text` (path en storage)
  - `uuid_fiscal text` (UUID del timbre fiscal del CFDI)
  - `uuid_estatus_sat text` (estatus SAT: Vigente/Cancelado/No encontrado)
  - `uuid_verificado_fecha timestamptz` (cuándo se verificó)
  - `updated_at` ya existe; se actualiza vía trigger existente.
- No requiere cambios a GRANTs/RLS principales; se mantiene la política actual de tenant + admin.

#### 2. Storage (bucket `facturas` existente)

- Reutilizar el bucket privado `facturas` y sus políticas por organización.
- Convención de path: `{organization_id}/nc/{proveedor_nota_credito_id}/{filename}`.
- Crear servicio `subirArchivosNcProveedor` en `src/features/cxp/services/cfdiStorage.ts` (o módulo hermano) para subir XML y/o PDF a la nota de crédito recién creada.

#### 3. Edge function `parse-cfdi-xml`

- Extender `parser.ts` para detectar el atributo `TipoDeComprobante` del CFDI y devolverlo en la respuesta (`cfdi.tipo_comprobante`).
- Si el tipo no es `E` (Nota de crédito), devolver advertencia en el response para que el frontend muestre un aviso tipo "Este CFDI no es una nota de crédito; verifica antes de guardar".
- No se requiere nueva función de edge; se reusa `parse-cfdi-xml`.

#### 4. Frontend — modal de registro de NC

- Modificar `src/features/cxp/components/DialogNotaCreditoProveedor.tsx`:
  - Agregar selector de modo: "Captura manual" / "Cargar XML CFDI".
  - En modo XML, reutilizar el hook `useCargaCfdi` y la experiencia de drop/arrastrar del componente `CargaCfdiSection` (versión simplificada para solo XML + PDF opcional).
  - Al procesar el XML, prellenar automáticamente:
    - `folio_nc` = `serie + folio` del CFDI.
    - `fecha` = fecha del comprobante.
    - `monto` = `total` del CFDI.
    - `moneda` = moneda del CFDI.
    - `uuid_fiscal` = UUID del timbre.
    - `descripcion` = primer concepto o notas de la IA.
  - Mostrar advertencia si el monto parseado excede el saldo de la factura (ya se valida hoy, pero ahora con datos automáticos).
  - Al guardar, primero insertar la NC en BD, luego subir XML/PDF al storage y actualizar las URLs en el registro.

#### 5. Frontend — listado de NCs

- Modificar `src/features/cxp/components/NotasCreditoSection.tsx`:
  - Mostrar iconos/indicadores de XML/PDF adjuntos en cada fila.
  - Permitir abrir/descargar el XML y el PDF usando el helper existente `getFacturaSignedUrl`/`openFacturaInNewTab` (renombrar o extender a archivo genérico de bucket `facturas`).

#### 6. Verificación SAT opcional

- Reutilizar el hook `useVerificarUuidSat` para permitir verificar el UUID de la NC contra el SAT, igual que en facturas de proveedor.
- Mostrar badge de estatus SAT en la sección de NC.

#### 7. Validaciones y seguridad

- El parseo debe seguir soportando CFDI 4.0 y rechazando > 2 MB y DOCTYPE.
- El monto de la NC nunca puede superar el saldo de la factura (regla existente; se mantiene).
- Sólo usuarios con rol `admin`/`super_admin` pueden crear NCs (regla existente).
- Los archivos se guardan bajo el `organization_id` para respetar RLS del storage.

#### 8. Tests y calidad

- Test unitario para el helper de prellenado desde `CfdiParsedResponse`.
- Test de servicio `subirArchivosNcProveedor` con mock de storage.
- Asegurar que `architecture-baseline.test.ts` y lint (`bun run lint -- --max-warnings 0`) sigan pasando.
- Actualizar `CHANGELOG.md` y `APP_VERSION` (bump a `13.305.11`).

### Entregables visibles

1. En el modal "Registrar nota de crédito" aparece una pestaña "Cargar XML CFDI".
2. Al arrastrar el XML del SAT, se llenan automáticamente folio, fecha, monto y moneda.
3. El usuario puede adjuntar PDF opcional.
4. En la tabla de NCs se ve un icono de XML/PDF para descargar cada nota.

### Riesgos
- El parser actual es genérico y no distingue I/E/P/N. Detectar `TipoDeComprobante` reduce el riesgo de cargar una factura normal como NC.
- El flujo requiere crear el registro primero para obtener el `id` y luego subir archivos. Manejaremos rollback: si falla la subida a storage, se deja la NC sin archivos y se notifica al usuario para que pueda reintentar.