# Quitar "Invoice" del detalle de embarque

Todo el texto visible en el detalle de embarque y sus pestañas debe decir **factura**, no "invoice". Sólo cambia el copy en español; nada de lógica, nombres de funciones ni la edge function `parse-invoice-pdf` (eso es un identificador técnico interno, no lo ve el usuario).

## Textos que cambian

| Dónde se ve | Ahora | Queda |
|---|---|---|
| Checklist de cierre (fase Expediente) | "Invoices del buzón capturados" | "Facturas del buzón capturadas" |
| Checklist de cierre, detalle del pendiente | "2 invoice(s) del buzón sin capturar" | "2 factura(s) del buzón sin capturar" |
| Checklist de cierre, detalle del pendiente | "2 proveedor(es) sin invoice adjunto: COSCO, DHL" | "2 proveedor(es) sin factura adjunta: COSCO, DHL" |
| Pestaña Costos → Facturas de proveedor recibidas | "Sube el PDF y el XML del invoice en un mismo documento…" | "Sube el PDF y el XML de la factura en un mismo documento…" |
| Diálogo Subir factura entrante, placeholder de notas | "Ej. Invoice del agente en Shanghái…" | "Ej. Factura del agente en Shanghái…" |
| Zona de archivos (PDF), texto de ayuda | "Representación impresa del invoice" | "Representación impresa de la factura" |

## Detalles técnicos

Archivos a editar (sólo cadenas de texto):

- `src/features/embarques/utils/cierreCheckMeta.ts` — etiqueta del check `facturas_entrantes`.
- `src/features/embarques/utils/cierreCheckFormatters.ts` — 3 plantillas de detalle, ajustando la concordancia de género ("sin factura adjunta").
- `src/features/embarques/components/TabFacturasEntrantes.tsx` — texto de ayuda de la sección.
- `src/features/embarques/components/SubirFacturaEntranteDialog.tsx` — placeholder de notas.
- `src/features/embarques/components/entrantes/ArchivosEntranteDropZone.tsx` — ayuda del bloque PDF.

Tests a actualizar (esperan las cadenas viejas):

- `src/features/embarques/utils/__tests__/cierreCheckEntrantes.test.ts` — 4 aserciones de texto.

Después: barrido final con búsqueda de "invoice" en el detalle de embarque para confirmar que sólo quedan referencias técnicas (nombre de la edge function y comentarios de código), bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
