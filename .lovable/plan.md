# Cuadrar los totales de la tabla de conceptos (CxP)

## Qué está pasando

Desde el cambio en el parser (v13.399.1), la columna **Importe** de cada renglón guarda el **precio unitario**, no el total de la línea. Las tablas de conceptos siguen sumando esa columna tal cual, así que el renglón "Totales" muestra la suma de precios unitarios.

En el modal abierto: 2,750 + 35 + 13 + 50 + 50 = **USD 2,898**, pero el subtotal real (unitario × cantidad) es 22,000 + 35 + 104 + 400 + 50 = **USD 22,589** — exactamente el subtotal que valida el semáforo de cuadre. O sea: el semáforo tiene razón y el pie de la tabla es el que engaña.

## Qué se va a corregir

1. **Vista previa del CFDI en el modal** (`CfdiConceptosPreview.tsx`)
   - Renombrar la columna a **Importe unit.** y agregar una columna **Total línea** = unitario × cantidad.
   - El renglón "Totales" suma los totales de línea (no los unitarios), usando el mismo helper de suma que ya usa el semáforo (`sumarConceptos` de `cuadreConceptos.ts`) para que ambos números sean siempre idénticos.
   - IVA/IEPS se siguen sumando como vienen del SAT.

2. **Conceptos en el detalle de la factura** (`ConceptosFacturaSection.tsx`)
   - Mismo tratamiento: columna "Importe unit." + "Total línea" y totales sobre el total de línea, para que no se contradiga con el subtotal guardado.

3. **Tests**
   - Casos en la carpeta de tests de conceptos: cantidad > 1, cantidad nula/0 (se toma 1) y consistencia entre el total de la tabla y `sumarConceptos`.

## Notas técnicas

- Se reutiliza `sumarConceptos` (currency.js, precisión 4) — no se introduce aritmética nueva ni se toca el parser ni la base de datos.
- Sólo cambia presentación; lo que se persiste en `proveedor_facturas_conceptos` no se modifica.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.
