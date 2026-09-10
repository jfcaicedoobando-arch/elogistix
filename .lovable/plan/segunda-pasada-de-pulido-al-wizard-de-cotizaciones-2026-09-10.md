# Segunda pasada de pulido al wizard de cotizaciones

Revisé los cuatro pasos en el navegador (cotización COT-2026-0242, pantalla de 1440 px). La estandarización anterior ya se ve: los pasos comparten ancho, los avisos son iguales y el resumen de utilidad ya no se repite. Pero la revisión visual muestra cinco problemas concretos que sí conviene pulir.

## Lo que se ve mal hoy

1. **Paso 2: la tabla no cabe.** Las columnas Utilidad, Margen y el botón de eliminar quedan fuera de la pantalla; hay que arrastrar la tabla de lado para borrar un renglón. Además los importes se parten en dos líneas ("USD" arriba, "6,100.00" abajo).
2. **Paso 2: las notas ocupan demasiado.** Cuando un concepto trae nota, se abre un cuadro de tres líneas de alto que separa los renglones y hace ver la tabla desordenada.
3. **Paso 2: el icono de moneda quedó suelto** entre el título y el botón Agregar, en lugar de ir junto al título.
4. **Paso 3 no se parece al paso 2.** Los conceptos del cliente no tienen encabezados alineados, la unidad sale cortada ("conten…"), las notas siempre están abiertas, el bloque en MXN se ve en dos bandas grises distintas al de USD y usa otras palabras ("P. Unitario" contra "Venta unit.").
5. **La barra fija de totales tapa el final del contenido.** En el paso 3 la última línea ("Los conceptos en MXN incluyen IVA 16%") queda oculta detrás de la barra.
6. **Paso 4:** el aviso "La cotización se guardará en estado Borrador" sale en color de advertencia (ámbar) aunque sólo informa, y ese texto se muestra igual al editar una cotización que ya no es borrador.

## Qué se va a hacer

**Tanda A — que el paso 2 quepa en pantalla**
- Poner la moneda una sola vez (ya está en el título "Costos en USD" y en el encabezado de columna) y dejar los importes como número, para que no se partan en dos líneas.
- Recortar los anchos de Proveedor, Unidad y los importes para que las diez columnas entren sin arrastrar en pantallas normales, dejando el desplazamiento sólo como respaldo en pantallas chicas.
- Dejar la columna de acciones (notas y eliminar) siempre visible.
- Mover el icono de moneda junto al título de la sección.

**Tanda B — notas compactas**
- El cuadro de notas pasa a una línea de alto y crece sólo si el texto lo necesita, igual en paso 2 y paso 3.

**Tanda C — igualar el paso 3 al paso 2**
- Encabezados de columna alineados con los campos, unidad sin recortarse, notas bajo demanda con el mismo botón, y el bloque MXN con el mismo fondo y ritmo que el de USD.
- Mismas palabras que el paso 2: "Venta unit.", "Total", "IVA".

**Tanda D — barra fija y aviso final**
- Reservar espacio abajo del contenido para que la barra de totales no tape la última línea de ningún paso.
- El aviso del paso 4 pasa a informativo, y el texto se ajusta a lo que realmente va a pasar (crear borrador / guardar cambios).

## Detalles técnicos

- Archivos: `costosLocal/columnasCosto.ts`, `costosLocal/FilaCostoLocalRow.tsx`, `TablaCostosLocal.tsx`, `SeccionCostosInternosPLLocal.tsx`, `SeccionConceptosVentaCotizacion.tsx`, `conceptos/ConceptoRowUSD.tsx`, `conceptos/ConceptoRowMXN.tsx`, `PasoResumenCotizacion.tsx`, y el contenedor de `WizardShell`/`CotizacionWizardLayout` sólo para el espacio inferior.
- Sólo presentación: no se tocan cálculos, IVA, tipo de cambio, guardado, RPCs, permisos ni base de datos. Los `aria-label` y `data-testid` existentes se conservan.
- Los avisos siguen usando `Alert` con variantes semánticas (guardia `no-raw-callout`); nada de colores fijos ni estilos en línea.
- Se agregan/ajustan pruebas focalizadas: encabezados y anchos compartidos en paso 3, notas de una línea, y ancho de cuadrícula sin recortes.
- Validación local: typecheck, ESLint focalizado, pruebas focalizadas de cotizaciones y arquitectura, más revisión visual de los cuatro pasos en el navegador. CI, RLS y E2E completos quedan a GitHub Actions.
- Cierre: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.
