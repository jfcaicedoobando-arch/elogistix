## Problema

En el detalle de la factura de proveedor **FP-000042** el PDF no aparece porque nunca se guardó: en la base de datos el campo `archivo_pdf_url` está en NULL y el bucket sólo tiene el XML. Hoy los CFDI adjuntos sólo se pueden cargar al **crear** la factura; después ya no hay forma de subir/reemplazar/quitar un archivo desde el detalle.

## Objetivo

Que cualquier usuario con permiso de editar la factura pueda **subir, reemplazar o quitar** el XML y el PDF desde el modal de detalle, sin tener que volver a crear la factura. Y de paso, arreglar el caso concreto de Carol subiendo el PDF real de FP-000042.

## Plan

### 1. Nuevo control de adjuntos en el detalle

En `src/features/cxp/components/InfoFacturaSection.parts.tsx` (o un componente hermano), reemplazar el `AdjuntoRow` actual (que sólo muestra "no adjunto") por una versión con acciones:

- Si hay archivo: ver + reemplazar + quitar.
- Si no hay archivo: botón "Adjuntar XML" / "Adjuntar PDF".

Reglas UX:
- Sólo visible si la factura **no** está `Cancelada` y el usuario tiene permiso de edición (mismo flag que ya usa el modal).
- Confirmación tipo "¿Reemplazar el archivo actual?" antes de sobrescribir.
- Validación de tipo (`.xml` / `.pdf`) y tamaño (2 MB XML, 10 MB PDF).

### 2. Servicio de storage reutilizable

Extender `src/features/cxp/services/cfdiStorage.ts` con dos funciones:

- `adjuntarArchivoCfdiFactura({ facturaId, organizationId, tipo: "XML"|"PDF", file })` — reusa `subirArchivosCfdiFactura` y luego hace `UPDATE proveedor_facturas SET archivo_xml_url|archivo_pdf_url = path`.
- `quitarArchivoCfdiFactura({ facturaId, path, tipo })` — borra el objeto en `storage` (best-effort) y pone la columna en NULL.

Ambas respetan el prefijo `{organization_id}/cfdi/{facturaId}/…` que exige la RLS del bucket `facturas` (ver `mem://technical/storage-rls-paths`).

### 3. Hook con invalidación de cache

Nuevo `useAdjuntoFacturaProveedor` que envuelve las mutaciones con React Query e invalida las queries del detalle (`["cxp","factura",facturaId]`, listado y KPIs) para que la UI muestre el archivo sin refrescar la página.

Manejo de errores vía `notifyError` (no `toast.error`, conforme a la regla del proyecto) y `AprobacionFacturaError`-style para mensajes claros de RLS/tamaño.

### 4. Fix de datos para FP-000042

Como paso separado y explícito:

- Pedir a Carol el PDF por chat.
- Subirlo manualmente al bucket en el path `00000000-…000001/cfdi/6b0467d6…/FCON-B0000016531.pdf`.
- Actualizar `proveedor_facturas.archivo_pdf_url` de la factura `6b0467d6…` con ese path.

Este paso se puede hacer con las mismas nuevas funciones una vez desplegadas (más limpio que un `UPDATE` a mano).

### 5. Tests

- Extender `src/features/cxp/services/__tests__/cfdiStorage.test.ts` para cubrir `adjuntarArchivoCfdiFactura` (verifica que el path sigue empezando con `organization_id`) y `quitarArchivoCfdiFactura` (verifica delete + `UPDATE ... = NULL`).
- Test de componente ligero para `AdjuntoRow` verificando que el botón "Reemplazar" pide confirmación.

### 6. Changelog + versión

- Bump `APP_VERSION` a `13.307.5`.
- Entrada en `CHANGELOG.md` describiendo la nueva capacidad de gestionar adjuntos desde el detalle y el fix puntual de FP-000042.

## Detalles técnicos

- Bucket privado `facturas`, política RLS: primer segmento del path = `organization_id`. Mantener `upsert: true` en `upload` para permitir reemplazos limpios.
- `storage.remove` puede fallar si el objeto ya no existe: tratarlo como no-op (no romper el flujo si la columna se queda en NULL de todos modos).
- No tocar `parse-invoice-pdf` ni el flujo de creación — el problema es post-creación.

## Analogía para pilotearlo mental

Hoy la factura es como un sobre que se **sella** al meterlo en el archivero: si olvidaste un papel adentro, ya no puedes abrirlo. Con este cambio el sobre pasa a tener un **clip**: puedes agregar, cambiar o quitar hojas sin romperlo.

## Fuera de alcance

- No cambia el flujo de creación (tabs Manual/CFDI/PDF IA).
- No toca notas de crédito de proveedor (misma mejora aplica pero se hace en otro plan si se pide).
- No re-parsea el XML al reemplazarlo — sólo lo guarda como archivo.
