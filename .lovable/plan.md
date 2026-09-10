# Tercera pasada visual del wizard de cotizaciones

Revisé los pasos 2 y 3 en tu mismo ancho (1108 px, con el menú lateral abierto). Esto es lo que se ve mal hoy y cómo se corrige. Sólo presentación: no se toca ningún cálculo, IVA, tipo de cambio, guardado ni permisos.

## Lo que se ve mal hoy

1. **Paso 2 se corta a la derecha.** Las columnas Venta total, Utilidad, Margen y el botón de eliminar quedan fuera de la pantalla; hay que arrastrar la tabla de lado para borrar un renglón.
2. **Campos de dinero sin formato.** Los campos de captura muestran `6100` y `6650` mientras las columnas calculadas al lado muestran `6,100.00`. Dos formas de escribir dinero en el mismo renglón.
3. **Selects truncados.** "Pacific Inter…", "contenec…" y el de IVA reducido a "0…" en el paso 3.
4. **La barra de totales flota encima del contenido.** En los pasos 2 y 3 se ve como una tarjeta suelta que tapa el final de la sección.
5. **Notas siempre abiertas.** Un concepto con nota abre un cuadro alto que rompe el ritmo de los renglones.
6. **El renglón en MXN del paso 3 usa otra forma** que el de USD: parte el concepto en dos bandas (datos arriba, Subtotal/IVA/Venta total abajo) mientras USD va en una sola línea.

## Qué se va a hacer

**Tanda A — que el paso 2 quepa sin arrastrar**
- En pantallas medianas se muestran Concepto, Proveedor, Unidad, Cant., Costo unit., Venta unit. y las acciones. Costo total, Venta total, Utilidad y Margen se leen en el pie de la sección y en el resumen del paso 4; en pantallas anchas siguen apareciendo en el renglón.
- La columna de acciones (nota y eliminar) queda siempre visible, nunca dentro del área que se desplaza.

**Tanda B — dinero con formato**
- Los campos de costo y venta se formatean al salir del campo (escribes `6100`, al salir se lee `6,100.00`) y al volver a entrar se editan limpios. Se conserva el parseo actual, así que no cambia ningún resultado.
- Todos los importes alineados a la derecha, mismos dos decimales en captura y en cifras calculadas.

**Tanda C — selects que sí se leen**
- Se reparten los anchos para que quepan los valores comunes ("Contenedor", "16 % — IVA"), y los nombres largos de proveedor se acortan con tres puntos más el texto completo al pasar el cursor.

**Tanda D — una sola barra al pie**
- Costo, venta, utilidad y margen se integran a la misma franja inferior donde están Anterior y Siguiente: una sola barra, nada flotando sobre el contenido. Se retira el espacio extra que hoy se reserva para la tarjeta flotante.

**Tanda E — consistencia de renglones**
- Notas cerradas por omisión en los pasos 2 y 3, con indicador cuando el concepto ya tiene nota, y campo de una línea que crece sólo si hace falta.
- El renglón en MXN del paso 3 adopta la misma estructura de una línea que el de USD, con Subtotal/IVA/Venta total como columnas calculadas (mismas reglas de ocultamiento de la Tanda A).

## Detalles técnicos

- Archivos: `costosLocal/columnasCosto.ts`, `costosLocal/FilaCostoLocalRow.tsx`, `TablaCostosLocal.tsx`, `SeccionCostosInternosPLLocal.tsx`, `SeccionConceptosVentaCotizacion.tsx`, `conceptos/ConceptoRowUSD.tsx`, `conceptos/ConceptoRowMXN.tsx`, `WizardTotalsBar.tsx`, `CotizacionWizardLayout.tsx` y `wizard/WizardShell.tsx` (sólo el pie y el espacio inferior).
- El formato de dinero reutiliza los helpers existentes (`formatNumber`, `parseMonto`/`useNumericField`); no se introduce un parser nuevo ni se cambia el momento en que se confirma el valor (`onBlur`).
- Sin cambios en `useCotizacionWizardForm`, `calcTotalsPL`, `financialUtils`, RPCs, guardado, IVA, tipo de cambio, permisos ni base de datos.
- Sólo tokens semánticos y `Alert` con variantes; nada de colores fijos ni estilos en línea. Se conservan `aria-label` y `data-testid` existentes.
- Pruebas focalizadas: columnas visibles por ancho, formato al salir del campo, notas cerradas por omisión, paridad de estructura USD/MXN en el paso 3.
- Validación local: typecheck, ESLint focalizado, pruebas focalizadas de cotizaciones y revisión visual de los 4 pasos a 1108 px y 1440 px. CI, RLS y E2E completos quedan a GitHub Actions.
- Cierre: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Fuera de alcance

Campos nuevos, cambios de reglas de negocio, nueva navegación por pasos, autoguardado o cualquier función adicional.
