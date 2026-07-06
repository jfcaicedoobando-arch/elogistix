## Objetivo

Enriquecer la página de detalle de factura (`/facturacion/:id`) para que, cuando una factura está cancelada, el usuario pueda:

1. Descargar el **acuse de cancelación** del SAT (XML nativo y PDF generado a partir de ese XML).
2. Reintentar la descarga del acuse cuando el SAT aún no lo emitió (`status = pending`).
3. Ver el **historial completo** de la factura (no sólo bitácora para admin).

## Contexto encontrado

- La edge function `facturapi-cancelar` ya guarda `acuse_cancelacion_xml`, `acuse_cancelacion_fecha`, `acuse_cancelacion_status`, `cancelacion_motivo`, `fecha_cancelacion` en `public.facturas`. Esos campos ya existen en `types.ts`.
- El detalle de factura ya usa `FacturaBitacoraCard`, pero está oculto detrás de `isAdmin`, y sólo muestra "bitácora" (nombre técnico).
- La barra de acciones vive en `FacturaDetalleActions.tsx`. Cuando la factura está cancelada, hoy sólo muestra "Descargar PDF/XML" (del CFDI original) y "Ver embarque".
- El acuse SAT sólo se emite como XML; el "PDF del acuse" se genera del lado cliente a partir de los datos ya guardados (uuid, folio, fecha cancelación, motivo, status acuse). Esto es análogo a un "recibo impreso" a partir del sello XML.

## Cambios

### 1. Descargar acuse XML (nuevo botón en detalle)

En `FacturaDetalleActions.tsx` y `FacturaDetalle.tsx`:
- Nuevas props: `estaCancelada`, `acuseXml`, `acuseStatus`, `onDescargarAcuseXml`, `onDescargarAcusePdf`, `onReintentarAcuse`.
- Cuando `estado === "Cancelada"`:
  - Si `acuse_cancelacion_xml` existe → botones **"Acuse XML"** y **"Acuse PDF"**.
  - Si `acuse_cancelacion_status !== "accepted"` (pendiente / error) → botón **"Reintentar acuse"** que reinvoca `facturapi-cancelar` (o un endpoint dedicado — ver decisión abajo) para volver a intentar la descarga.
- Handler `onDescargarAcuseXml`: crea un `Blob` con el XML guardado, dispara download `acuse-cancelacion-{numero}.xml`.

### 2. Generar PDF del acuse (cliente)

Nuevo generador `src/generators/acuseCancelacionPdf.tsx` (react-pdf, alineado a los generadores existentes en `src/pdf/`):
- Encabezado con logo/emisor (reutiliza `BrandHeader`).
- Bloque con: número de factura, UUID SAT, folio fiscal, RFC emisor/receptor, cliente.
- Bloque cancelación: fecha de cancelación, motivo (con etiqueta legible 01–04), UUID de la factura sustituta si aplica.
- Bloque acuse: status del acuse, fecha del acuse.
- Pie de página aclarando que el documento oficial es el XML.
- Se descarga vía `descargarPdf` con nombre `acuse-cancelacion-{numero}.pdf`.

### 3. Reintento de descarga del acuse

Opción elegida: **reusar `facturapi-cancelar`** con un flag nuevo `{ factura_id, solo_descargar_acuse: true }`. La edge:
- Si la factura ya está cancelada, salta el `invoices.cancel(...)` y sólo llama a `descargarAcuseCancelacion(...)` actualizando `acuse_cancelacion_xml/fecha/status`.
- Si no, comportamiento actual sin cambios.
- Alternativa: crear `facturapi-descargar-acuse`. La reutilización es más simple y consistente.

### 4. Historial de la factura visible siempre

Renombrar `FacturaBitacoraCard` → **`FacturaHistorialCard`** (título "Historial") y quitar el gate `isAdmin` en `FacturaDetalle.tsx`. El hook `useBitacora` ya filtra por `entidad_id = facturaId`; los eventos incluyen: `crear`, `timbrar`, `enviar_email`, `cancelar`, `pago_registrado`, etc. Se ordena descendente por `created_at` y se muestra en la columna derecha, debajo de los pagos.

### 5. Housekeeping

- Bump `APP_VERSION` a `13.205.7`.
- Entrada en `CHANGELOG.md`.

## Diagrama de la nueva barra (factura cancelada)

```text
[Descargar PDF factura] [Descargar XML factura] [Enviar por email]
[Acuse XML] [Acuse PDF] [Reintentar acuse (si pending)] [Ver embarque]
```

## Fuera de alcance

- No se cambia la lógica de cancelación ni el modelo de datos.
- No se toca `facturapi-cancelar-nota-credito` ni `facturapi-cancelar-rep` (se puede extender en otra iteración con la misma receta).
- No se agrega historial al portal cliente (`PortalFacturaDetalle`).

## Preguntas rápidas antes de construir

1. ¿El "PDF del acuse" te sirve como reporte generado por nosotros (con los datos del XML), o esperas descargar un PDF oficial del SAT (que **no existe** — el SAT sólo entrega XML)?
2. ¿El historial lo quieres visible para **todos los roles** o sólo para roles internos (admin/operaciones/vendedora)?
