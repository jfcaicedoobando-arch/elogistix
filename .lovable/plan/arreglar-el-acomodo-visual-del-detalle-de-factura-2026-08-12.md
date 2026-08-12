# Arreglar el acomodo visual del detalle de factura

## Qué encontré (medido en el navegador, no supuesto)

Abrí la factura **F977** en el preview (1068 px) y en HD (1920 px) y medí las cajas reales de cada bloque.

**En HD (1920) la pantalla se ve correcta.** El problema aparece entre **1024 y ~1300 px de ancho**, que es exactamente el rango del preview de Lovable (1068) y de muchas laptops (1280).

Tres defectos concretos, todos en ese rango:

### 1. El título de la factura se aplasta detrás de los botones
El encabezado pasa a dos columnas (título | botones) a partir de 1024 px, pero la barra de acciones mide **641 px fijos** y no cede espacio. La columna del título se queda sin ancho:

| Ancho | Ancho real del título "F977" | Resultado |
|---|---|---|
| 1024 px | **0 px** | título invisible; los botones se montan encima |
| 1068 px | **31 px** (necesita 64) | título cortado a la mitad |
| 1280 px | 64 px | correcto, pero los botones llegan al filo |
| 1366+ px | 64 px | correcto |

Además, al aplastarse la columna, el cliente, la fecha y el semáforo de estado se apilan en tiras verticales y generan el **hueco vacío gigante** que se ve antes de la cinta de totales.

### 2. Las pestañas se cortan sin aviso
La tira de pestañas necesita 657 px pero sólo tiene 352–576 px disponibles. "Notas de crédito" y "Documentos" quedan fuera de la vista, con scroll horizontal invisible: parece que no existen.

### 3. La tabla de conceptos no cabe en su columna
La tabla mide 563 px dentro de una columna de 352–396 px, porque el riel de "Historial y actividad" se coloca al costado desde 1024 px. Las columnas **IVA** e **IMPORTE** quedan cortadas.

## Qué voy a cambiar

Los tres defectos viven en componentes compartidos por **23 pantallas de detalle** (factura, proforma, factura de proveedor, embarque, cliente, proveedor), así que el arreglo las beneficia a todas.

1. **Encabezado**: el título nunca se aplasta. La barra de acciones sólo se coloca al costado del título cuando de verdad hay espacio; abajo de ese umbral se acomoda en su propio renglón completo, como ya hace en móvil. El título conserva un ancho mínimo legible.
2. **Riel de historial**: se coloca al costado a partir de un ancho mayor, de modo que el contenido principal nunca quede por debajo de ~600 px. Debajo de ese umbral el historial se apila al final, como en móvil.
3. **Pestañas**: cuando no caben, se muestra un indicador de desplazamiento (degradado en el borde) para que se vea que hay más secciones.
4. **Tabla de conceptos**: se amplía el rango en el que se usa la vista de tarjetas legible en lugar de la tabla comprimida, y la tabla mantiene su scroll propio sin desbordar el card.

## Cómo lo valido

- Recaptura del detalle de F977 en **1024, 1068, 1280, 1366 y 1920 px**, verificando por medición que el título mide su ancho completo, que las 5 pestañas son alcanzables y que la tabla no desborda su columna.
- Revisión visual de las capturas antes y después.
- Los tests de arquitectura y tipos existentes deben seguir pasando.
- `CHANGELOG.md` + `APP_VERSION` actualizados (13.548.0).

## Detalle técnico

- `src/components/shared/DetailHeader.tsx`: el corte horizontal pasa de `lg` a `xl`; se retira `lg:flex-nowrap` del contenedor `trailing` y se añade una base mínima al bloque de título para que `flex-1 min-w-0` no colapse a 0.
- `src/components/shared/documento/DocumentoLayout.tsx`: la rejilla de dos columnas arranca en `xl` (riel 19rem) y `2xl` (21rem) en lugar de `lg`/`xl`.
- `src/components/shared/documento/DocumentoTabs.tsx`: máscara/degradado de desbordamiento en `TabsList`.
- `src/features/facturacion/components/detalle/FacturaConceptosRows.tsx`: el cambio tarjetas → tabla pasa de `md` a `lg`, y la tabla conserva `overflow-x-auto` con ancho mínimo.
- Sin cambios de datos, RPCs ni lógica de negocio: es puramente presentación.
