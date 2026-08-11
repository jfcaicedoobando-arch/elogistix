# Mejorar el modal "Subir factura de proveedor al buzón"

## Por qué hoy se ven 3 recuadros

El modal tiene una zona grande para arrastrar archivos **más** dos ranuras vacías (PDF y XML) que están visibles aunque no hayas subido nada. Es como tener un buzón y, al lado, dos casilleros vacíos etiquetados: se ve como tres lugares donde soltar, pero sólo uno recibe archivos.

## Cambio 1 — Una sola zona de carga

- Se mantiene una única zona de arrastrar/clic.
- Las ranuras dejan de ser cajas de carga: se convierten en **dos chips de estado** debajo de la zona (`PDF ✓ nombre.pdf` / `XML pendiente`), compactos, con botón de quitar sólo cuando hay archivo.
- El chip faltante se ve en gris con la leyenda de por qué importa (XML obligatorio en proveedores mexicanos), sin parecer otro recuadro para soltar archivos.
- Se mantienen los avisos actuales: "leyendo el XML", errores y la advertencia de "sin XML sólo puede capturarse como factura extranjera".

## Cambio 2 — Orden y densidad del modal

Secuencia final del modal, de arriba a abajo:

```text
1. Archivos            (zona única + chips PDF/XML)
2. Datos detectados    (folio, total, RFC, fecha, UUID del CFDI)
3. Proveedor           (sugerido por RFC, obligatorio)
4. Verificación de monto  (nuevo)
5. Nota para contabilidad (colapsada por defecto)
```

La nota deja de ocupar un bloque completo: se muestra como enlace "Agregar nota para contabilidad" que despliega el campo.

## Cambio 3 — Monto declarado y cotejo contra lo costeado (sí, conviene)

Sí conviene, pero como **verificación que avisa, no que bloquea**: operaciones es quien conoce lo que se cotizó, y detectar la diferencia al subir el documento evita que contabilidad capture una sobrefacturación.

Comportamiento:
- Campo **Monto de la factura** + selector de moneda (MXN/USD/EUR).
- Si el XML trae total, el campo se **prellena** desde el CFDI y se marca como "leído del CFDI"; si el operador lo edita a un valor distinto, se avisa que no coincide con el XML.
- Se compara contra la suma de **costos vivos del embarque para ese proveedor** (`conceptos_costo`, misma moneda):
  - diferencia ≤ 1% (o ≤ $1): chip verde "Coincide con lo costeado".
  - diferencia mayor: chip ámbar con el detalle "Facturado 1,200 USD vs costeado 1,000 USD · +200 USD (20%)".
  - monedas distintas o proveedor sin costos: mensaje neutro "No hay costos comparables en esta moneda".
- Nunca impide enviar al buzón; la diferencia queda guardada y visible en el buzón y al capturar la factura.

## Detalles técnicos

- Migración: agregar a `embarque_facturas_entrantes` las columnas `monto_declarado numeric`, `moneda_declarada text` (nullable, con CHECK en MXN/USD/EUR), sin cambiar RLS ni GRANTs existentes.
- `SubirFacturaEntranteInput` + `filaEntranteAInsertar` persisten los dos campos nuevos; `SELECT_COLS_ENTRANTES` y `FacturaEntranteRow` los exponen.
- `useSubirEntranteForm`: estado `montoDeclarado` / `monedaDeclarada`, prellenado desde `meta.total`/`meta.moneda`, validación numérica (> 0, máx. 2 decimales) con zod.
- Nuevo servicio `fetchCostosProveedorEmbarque(embarqueId, proveedorId)` en `services/queries/proveedores.ts` (suma por moneda de `conceptos_costo` vivos) + hook con React Query.
- Nuevos componentes chicos (≤200 líneas cada uno): `ArchivosEntranteChips.tsx`, `VerificacionMontoEntrante.tsx`, `NotaContabilidadCampo.tsx`; `ArchivosEntranteDropZone.tsx` se reduce a la zona única.
- `FacturaEntranteItem.tsx` muestra el monto declarado y el chip de diferencia cuando exista.
- Tests: comparador de montos (coincide / difiere / monedas distintas), prellenado desde CFDI y edición manual, y render de los chips de archivos.
- Sin colores hardcodeados: tokens `success` / `warning` / `muted` existentes.
- `CHANGELOG.md` + `APP_VERSION` → 13.503.0.
