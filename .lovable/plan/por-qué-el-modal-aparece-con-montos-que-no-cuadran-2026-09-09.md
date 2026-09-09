# Por qué el modal aparece con montos que no cuadran

## Qué está pasando (verificado en el código)

Cuando la factura llega del buzón, el operador ya señaló qué costos del embarque cubre. El modal pre-marca esos costos en el paso 3, **convertidos a la moneda que en ese momento tiene la factura** (`usePrefillVinculosEntrante.ts`).

La secuencia del caso:

1. La factura arranca en **MXN** (valor inicial) y la IA además la leyó como MXN.
2. Los costos del embarque están en **USD**, así que se convierten a pesos con el tipo de cambio del día: se pre-marcan cifras grandes en pesos.
3. El subtotal viene del PDF (importes en dólares leídos como si fueran pesos), que es una cifra chica. De ahí el sobrante de MXN 444,467.13: se compara peras (costos convertidos a pesos) con manzanas (subtotal en dólares etiquetado como pesos).
4. Al corregir la moneda a USD en el paso 1, **nada recalcula lo ya pre-marcado**: `handleChange` sólo limpia el tipo de cambio y la precarga tiene un candado de "una vez por documento" (`aplicadoPara`). Por eso el paso 3 sigue mostrando el monto en pesos, ahora tratado como dólares.

O sea: no son montos inventados, es una precarga hecha con la moneda equivocada que ya no se refresca al corregirla.

## Qué se va a corregir

1. **Al cambiar la moneda de la factura, la precarga se rehace.** En `handleChange` (`useNuevaFacturaProveedorForm.ts`), cuando cambia `moneda` se limpian los vínculos pre-marcados. `usePrefillVinculosEntrante` deja de estar amarrado sólo al documento: su candado incluye la moneda, así que vuelve a pre-marcar los costos sugeridos convertidos a la nueva moneda (con el T/C DOF de la emisión, o los deja en "sin tipo de cambio" si no hay).
2. **No se pierde lo que el contador ya ajustó a mano sin avisar.** Si hay montos editados a mano, se avisa en pantalla que la precarga se recalculó por el cambio de moneda; el botón "volver a aplicar" que ya existe sigue siendo la vía manual.
3. **Aviso de descuadre más claro en el paso 3**: cuando lo pre-marcado excede el subtotal, el texto dice que puede deberse a una moneda mal detectada y sugiere revisar el paso 1.

## Qué NO cambia

- No se tocan facturas, pagos, costos ni embarques existentes (incluido lo ya corregido en ELIMP00329).
- No hay conversión automática de los importes del PDF: eso sigue siendo revisión manual, como se acordó.
- Sin migraciones, tablas, RPCs ni dependencias nuevas.

## Detalles técnicos

- `useNuevaFacturaProveedorForm.ts`: en la rama `k === "moneda"` de `handleChange`, `setVinculos({})` (mismo patrón que `handleProveedor`).
- `usePrefillVinculosEntrante.ts`: `aplicadoPara` pasa de `entrante.id` a `${entrante.id}#${facturaMoneda}`, para que el cambio de moneda dispare una nueva pre-marca ya convertida; se conserva la regla de no pre-marcar sin T/C.
- `PasoVinculacion.tsx` / banda de sugerencias: texto del descuadre menciona la moneda; sin estado nuevo.
- Regresiones mínimas (se ejecutan en GitHub Actions): cambiar MXN→USD limpia y vuelve a pre-marcar con montos en USD; sin T/C no pre-marca; un solo `aplicarSugerencias` por moneda.
- Cierre: `APP_VERSION` + `CHANGELOG.md` + manifiesto, typecheck, lint y build focalizados. Sin publicar.
