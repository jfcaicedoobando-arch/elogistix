## Objetivo

Agregar un **folio interno único por organización** a las facturas de proveedor con formato `FP-000001`, asignado automáticamente al capturar, inmutable, visible en toda la UI de CXP.

## 1) Migración (DB)

Una sola migración con:

### a) Schema
- `proveedor_facturas.folio_interno text` (nullable inicialmente para backfill, luego `NOT NULL`).
- Índice único: `UNIQUE (organization_id, folio_interno)` donde `deleted_at IS NULL` (partial index — permite reusar folio si se borra lógico, pero en la práctica nunca lo reusaremos).

### b) Contador por tenant
Tabla `folio_secuencias`:

```text
organization_id uuid
tipo            text     -- 'factura_proveedor' (extensible a futuro)
ultimo_numero   bigint   default 0
PRIMARY KEY (organization_id, tipo)
```

Con GRANTs estándar y RLS (sólo `service_role`; los usuarios no la tocan directo).

### c) RPC atómica `siguiente_folio_proveedor(p_org_id uuid) returns text`
- `SECURITY DEFINER`, `search_path=public`.
- `INSERT ... ON CONFLICT ... DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1 RETURNING ultimo_numero`.
- Devuelve `'FP-' || lpad(ultimo_numero::text, 6, '0')`.
- `GRANT EXECUTE TO authenticated`.

### d) Trigger `BEFORE INSERT`
- Si `NEW.folio_interno IS NULL`, lo calcula con la RPC. Garantiza que cualquier insert (UI, edge function, import) reciba folio.

### e) Backfill de las 12 facturas existentes
- Ordenadas por `created_at ASC`, asignar `FP-000001…FP-000012`. Actualizar contador a `12`.
- Luego `ALTER COLUMN folio_interno SET NOT NULL`.

## 2) Cambios de código

### Tipos & servicios
- Esperar regeneración automática de `src/integrations/supabase/types.ts` tras la migración.
- `src/features/cxp/services/proveedorFacturas.ts`: incluir `folio_interno` en los SELECT (`COLUMNAS_FACTURA_CXP`).
- `FacturaCxP` type: agregar `folio_interno: string`.

### Captura nueva (`useNuevaFacturaProveedorForm`)
- **No cambia**: el trigger asigna el folio. Tras `INSERT`, el `RETURNING` ya trae `folio_interno` para mostrarlo en el toast de éxito ("Capturada como FP-000013").

### UI
- **`cxpColumns.tsx`** — nueva columna **Folio interno** a la izquierda de "Folio prov." (50–90px, `font-mono`, badge sutil).
- **`DialogDetallePagosProveedor`** y **`DialogEditarFacturaProveedor`** — header muestra `FP-000013 · Folio prov. A-12345`.
- **`DialogEditarFacturaProveedor`** — agregar `folio_interno` al banner read-only (junto al proveedor).
- **PDF comprobante de pago** (`src/features/cxp/pdf/...` si existe) — incluir folio interno como referencia primaria.
- **Búsqueda CXP** (filtro de texto en `useCxpFiltros` / RPC de operadores) — buscar también por `folio_interno`.
- **Bitácora**: los `descripcion` de eventos CXP referencian `folio_proveedor`; cambiar a `folio_interno (folio prov.)` en los nuevos eventos. Eventos viejos quedan como están.

### Versionado
- `APP_VERSION` → `13.108.0` (feature).
- `CHANGELOG.md`: entrada explicando que ahora cada factura de proveedor tiene un folio interno `FP-XXXXXX` único por organización, autoincremental, usado en tabla, modales, PDFs y búsqueda. Las 12 facturas existentes recibieron folio en orden cronológico.

### Memoria
- Guardar `mem://features/folio-interno-cxp` con: formato, RPC `siguiente_folio_proveedor`, tabla `folio_secuencias`, política inmutable (nunca actualizar `folio_interno`), trigger BEFORE INSERT.

## 3) Fuera de scope

- Folios internos para **facturas de venta** (`facturas`), proformas, embarques o cotizaciones. Si después quieres replicar el patrón, la tabla `folio_secuencias` ya soporta más tipos.
- Configurar formato custom por organización (prefijo/longitud). Por ahora fijo `FP-` + 6 dígitos.
- Reasignar folios después de borrado lógico.

## Analogía 🎟️

Es como darle a cada factura un **número de ticket de taquilla** propio cuando entra al sistema. El folio del proveedor sigue ahí (como el nombre impreso en el boleto), pero internamente cada documento tiene un número único, corto y consecutivo que nadie más puede repetir — perfecto para ponerlo en una transferencia bancaria o referenciarlo por WhatsApp.
