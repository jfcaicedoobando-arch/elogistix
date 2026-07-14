## Contexto

Hoy el wizard tiene dos comportamientos distintos según el tipo de embarque:

- **FCL con tarifa vinculada** → el paso 2 "Costos & P&L" precarga automáticamente el flete + recargos usando `buildCostosDesdeTarifa` (ver `SeccionCostosInternosPLLocal.tsx`). El usuario no re-teclea nada.
- **LCL con captura manual** (bloque "Flete LCL" del paso 1: consolidador, tarifa W/M, mínimo) → el paso 2 **no** ve esos datos, así que el usuario tiene que volver a agregar la fila del flete a mano. Eso es la duplicación que estás notando.

Analogía: en FCL, el "cajero" del paso 2 ya tiene el ticket precargado desde la caja del paso 1. En LCL, ese ticket se queda en la caja y toca dictarlo otra vez. Vamos a conectar la caja LCL al mismo cajero.

## Objetivo

Que el paso 2 "Costos & P&L" precargue automáticamente **una fila de costo USD** con el flete LCL capturado en el paso 1, editable como cualquier otra fila. Sin duplicaciones y sin obligar al usuario a re-teclear.

## Diseño funcional

En el paso 2, cuando `tipoEmbarque === "LCL"` y existe `lclFleteManual` en el formulario, y la lista de filas está vacía (mismo criterio anti-doble-carga que ya usa FCL), se inserta una única fila:

| Campo          | Valor derivado                                              |
| -------------- | ----------------------------------------------------------- |
| Concepto       | `Flete marítimo LCL`                                        |
| Moneda         | `USD`                                                       |
| Proveedor      | `lclFleteManual.consolidador` (nombre del agente/consolidador) |
| Unidad medida  | `W/M`                                                       |
| Cantidad       | `wmFacturable` (calculado con `calcularTotalesLcl`)         |
| Costo unitario | `lclFleteManual.tarifaWM`                                   |
| Precio venta   | `calcularFleteVentaLCL(wm, tarifa, minimo) / wmFacturable` (para que `cantidad × precio_venta` coincida con la venta ya mostrada en paso 1, respetando el mínimo) |
| Aplica IVA     | `false` (USD)                                                |
| Notas          | `Mínimo USD X` cuando aplique el piso                       |

Comportamiento:

- Es una **precarga inicial**, igual que FCL: si la fila ya existe o el usuario la borró, no se vuelve a inyectar (control por `useRef` como el `precargadaRef` actual).
- Si el usuario cambia la tarifa W/M o el mínimo en el paso 1 y regresa al paso 2, la fila **no** se sobrescribe automáticamente (respetamos ediciones manuales). Mostramos un aviso discreto tipo el banner FCL: "Precargado desde Flete LCL (paso 1). Puedes editarlo."
- Si `tipoEmbarque` cambia de LCL a FCL (o viceversa), el efecto de precarga LCL no se dispara.

## Cambios técnicos

1. **`src/features/cotizacion/components/seccionRuta/buildCostosLCLManual.ts`** (nuevo): función pura que recibe `{ lclFleteManual, dimensionesLCL, pesoKg }` y devuelve `FilaCostoLocal[]` (una fila). Reutiliza `calcularTotalesLcl` y `calcularFleteVentaLCL` que ya existen.
2. **`src/features/cotizacion/components/SeccionCostosInternosPLLocal.tsx`**: agregar un segundo `useEffect` de precarga para el caso LCL manual (paralelo al de tarifa vinculada), con su propio `precargadaLclRef`. Añadir el banner informativo cuando la fila LCL fue autogenerada.
3. **Tests**:
   - `buildCostosLCLManual.test.ts` con casos: sin mínimo, con mínimo activado, sin dimensiones (devuelve `[]`).
   - Test de integración liviano en `SeccionCostosInternosPLLocal` que verifique que al montar con `lclFleteManual` presente se inyecta exactamente una fila.
4. **`CHANGELOG.md` + `APP_VERSION`**: bump a `13.299.14`, bullet "Costos & P&L precarga el flete LCL manual capturado en el paso 1, sin duplicaciones."

## Consideraciones

- No tocamos el paso 1: el bloque "Flete LCL (captura manual)" sigue siendo la fuente de verdad.
- No hay cambios de esquema ni de backend.
- Componentes se mantienen ≤200 líneas (extraemos la lógica a `buildCostosLCLManual.ts`).
- Cumple Power of 10: sin `any`, effects con cleanup, ref guard para evitar re-precargas.

## Fuera de alcance

- Sincronización bidireccional (editar la fila del paso 2 y que se refleje en el paso 1). Mantenemos el paso 1 como origen y el paso 2 como destino editable, igual que en FCL.
- Cambios visuales al bloque manual del paso 1.
