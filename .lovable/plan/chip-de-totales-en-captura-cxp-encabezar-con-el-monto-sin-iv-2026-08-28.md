# Chip de totales en captura CxP: encabezar con el monto sin IVA

## Problema

En el encabezado del modal de captura de factura de proveedor, el número grande
es el **total con IVA** (hoy se ve "Total USD · USD 342.20"). Pero todo el
cuadre de costos del ERP corre sobre el **subtotal sin impuestos**: la barra de
cuadre de conceptos compara conceptos contra subtotal, y el trigger de
aprobación en base de datos usa esa misma base. El capturista lee el número
grande, lo compara contra el costo cotizado y cree que no cuadra.

## Qué cambia

El chip del encabezado invierte la jerarquía:

- Número grande: **Subtotal <moneda>** (sin impuestos), la cifra con la que se
  concilia.
- Debajo, en letra pequeña y tono secundario: `Total con IVA <moneda> X`, para
  que el capturista siga pudiendo confirmar contra el papel/PDF del proveedor.
- El desglose del popover no cambia de contenido (Subtotal, IVA, IEPS,
  Retenciones, Total), sólo se refuerza: la etiqueta del último renglón queda
  como `Total con IVA <moneda>` y se agrega una nota corta:
  "Las conciliaciones de costo se hacen sobre el subtotal".

```text
antes                        después
┌──────────────────┐         ┌──────────────────────┐
│ TOTAL USD      ▾ │         │ SUBTOTAL USD       ▾ │
│ USD 342.20       │         │ USD 295.00           │
└──────────────────┘         │ Total con IVA 342.20 │
                             └──────────────────────┘
```

No se toca ningún cálculo, ni el guardado, ni la barra de cuadre, ni la base de
datos. Es sólo presentación en el encabezado del modal.

## Detalles técnicos

- `src/features/cxp/components/TotalesChipDesglose.tsx`: el trigger muestra
  `Subtotal {moneda}` + `formatCurrency(subtotal, moneda)` como cifra
  principal y una segunda línea `text-label text-muted-foreground` con el total
  con IVA. En `PopoverContent`, la etiqueta del renglón fuerte pasa a
  `Total con IVA {moneda}` y se añade el pie aclaratorio.
- `DialogNuevaFacturaProveedor.tsx` ya pasa `subtotal={sub}` y `total={ctl.total}`;
  no requiere cambios.
- Prueba de render nueva (o extensión de la existente si ya hay una para este
  componente) que verifique que el encabezado muestra el subtotal y que el total
  con IVA aparece como texto secundario.
- Cierre estándar: entrada en `CHANGELOG.md` (raíz) y bump de `APP_VERSION`.
