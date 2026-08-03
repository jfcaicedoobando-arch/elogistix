# Tarjeta de cuadre del modal "Capturar factura de proveedor"

## Qué es esa tarjeta (explicación)

Es el **semáforo de cuadre**: compara el **Subtotal** que capturaste en el encabezado de la factura contra la **suma de los conceptos** (partidas) que capturaste abajo.

Analogía: el subtotal es el total del ticket que dice el proveedor; los conceptos son los productos del ticket. Si los productos suman más que el total del ticket, algo está mal capturado.

Cómo calcula la suma de conceptos:

```text
por cada renglón:  línea = Importe (unitario) x Cantidad
suma conceptos  =  suma de todas las líneas   (sin IVA)
diferencia      =  Subtotal - suma conceptos
```

- Diferencia ~0 (tolerancia 1 centavo) -> verde "cuadrados", la factura se puede aprobar.
- Diferencia positiva -> amarillo "Faltan X por capturar".
- Diferencia negativa -> rojo "Sobran X sobre el subtotal".

## ¿La info está bien?

La aritmética es correcta y coincide con la validación del backend (`LC_CXP_DESCUADRE`), que impide aprobar una factura descuadrada. En tu caso: Subtotal USD 22,589 vs Conceptos USD 180,117 = sobran USD 157,528.

La causa más probable de una diferencia tan grande es que en algún renglón el campo **Importe** se llenó con el **total de la línea** mientras la **Cantidad** es mayor a 1: el sistema entiende "Importe" como precio **unitario** y lo multiplica por la cantidad. Cada renglón muestra su resultado en la nota "Línea: ..." — ahí se ve cuál se disparó. La otra causa posible es que el subtotal quedó en una moneda distinta a la de los conceptos.

Lo que sí está mal es la **claridad**, no el número: la tarjeta no dice de dónde sale la suma ni sugiere la causa real, y el consejo actual ("agrega un renglón negativo") es un mal consejo cuando el problema es un renglón mal capturado.

## Mejoras propuestas (solo UI/copy)

1. Etiquetar el campo como **"Importe unitario"** en el placeholder (hoy dice solo "Importe") y aclarar en la nota de la sección que la línea = unitario x cantidad.
2. En la tarjeta de cuadre, mostrar la diferencia con su fórmula corta: `Subtotal - Conceptos = diferencia`, y la cantidad de renglones considerados.
3. Cambiar el consejo del estado "Sobran": primero sugerir revisar renglones con cantidad mayor a 1 (posible importe capturado como total de línea) y verificar que el subtotal esté en la misma moneda; dejar el renglón negativo como segunda opción para descuentos reales.
4. Resaltar en la lista de conceptos el renglón con la línea más alta cuando hay sobrante, para localizar el error de un vistazo.
5. Mostrar la moneda de la tarjeta junto a los importes para detectar mezclas de moneda.

## Detalles técnicos

- Lógica de cálculo: `src/features/cxp/utils/cuadreConceptos.ts` (sin cambios de regla).
- Copy y presentación: `src/features/cxp/components/CuadreConceptosBar.tsx`.
- Etiquetas de captura: `src/features/cxp/components/ConceptosManualesSection.tsx`.
- Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION`.
