# Estandarizar el wizard de cotizaciones (UI/UX)

Objetivo: que los 4 pasos se sientan como una sola pantalla. Sin funciones nuevas, sin tocar cálculos, guardado, permisos ni base de datos.

## Qué está desalineado hoy (revisado en el código)

1. **Ancho distinto por paso.** El paso 1 ocupa el ancho completo del wizard (con su barra de progreso lateral); los pasos 2, 3 y 4 se encajonan en un contenedor más angosto dentro del mismo marco. Al avanzar, el contenido "salta" y se angosta.
2. **Dos estilos de tarjeta.** El paso 1 usa la sección estándar del wizard (título, subtítulo y check verde de "sección completa"); los pasos 2, 3 y 4 arman sus tarjetas a mano con separaciones distintas (unas con más aire que otras) y sin check.
3. **Los costos del paso 2 no son una tabla.** Cada renglón apila tres líneas (concepto/proveedor/unidad, luego cantidad/costo/venta, luego notas) sin encabezados de columna, y el pie de "Totales" usa anchos fijos que no coinciden con los campos de arriba: las cifras no quedan alineadas con nada.
4. **La utilidad se repite en cuatro lugares** en el mismo paso 2: insignia por renglón, pie de cada tabla, tarjeta "Resumen P&L" y barra fija inferior. Cuatro números que dicen lo mismo compiten por atención.
5. **El paso 4 duplica las tarjetas de utilidad** del paso 2 con otro código y otro espaciado, aunque muestran exactamente lo mismo.
6. **Cinco estilos de aviso.** Informativos, advertencias y avisos de "precargado desde tarifa" están escritos a mano con distintos colores, bordes y tamaños de letra en cada paso.
7. **Botón de agregar inconsistente.** En el paso 2 es un botón simple; en el paso 3 es un menú con captura rápida. Misma acción, dos comportamientos.
8. **Vocabulario mezclado.** Conviven "P&L", "profit" y "markup" con "utilidad" y "margen"; los títulos de paso ("Costos y utilidad") no coinciden con los títulos de las tarjetas.
9. **Renglones muy altos.** El campo de notas está siempre abierto en cada costo, así que con 6 conceptos el paso 2 obliga a mucho scroll.

## Plan de mejora (5 tandas, de mayor a menor impacto)

**Tanda 1 — Un solo marco.** Todos los pasos usan el mismo ancho y el mismo espaciado vertical; el contenido deja de saltar entre pasos. Los pasos 2, 3 y 4 pasan a usar la sección estándar del wizard (mismo título, misma separación, mismo check de completado que el paso 1).

**Tanda 2 — Rehacer el bloque de costos del paso 2.** Encabezados de columna fijos (Concepto · Proveedor · Unidad · Cant. · Costo · Venta · Importe · Utilidad · %), campos alineados exactamente bajo su encabezado y pie de totales que cae en las mismas columnas. Las notas se vuelven un botón por renglón que abre el campo sólo cuando se necesita. Se conservan tal cual las validaciones actuales (concepto obligatorio, aviso de concepto libre, límite de cantidad).

**Tanda 3 — Una sola fuente de utilidad.** La barra fija inferior queda como el indicador vivo (costo, venta, utilidad y margen por moneda) en los pasos 2 y 3. Dentro del paso 2 se conserva el pie de totales por tabla y la insignia de margen por renglón, y se retira la tarjeta "Resumen P&L" duplicada. El paso 4 muestra el resumen final reutilizando el mismo componente de tarjetas, no una copia.

**Tanda 4 — Avisos unificados.** Todos los mensajes (informativo, advertencia, error, "precargado desde tarifa") pasan por un solo componente de aviso con las variantes ya definidas en el sistema de diseño, con el mismo icono, borde y tamaño de letra en los 4 pasos.

**Tanda 5 — Lenguaje consistente en español de México.** "Utilidad" y "Margen" en toda la interfaz (se retiran "P&L", "profit", "markup" de textos visibles), títulos de tarjeta iguales a los títulos de paso, y misma forma de escribir montos y porcentajes.

## Alcance técnico

- Presentación únicamente: `CotizacionWizardSteps.tsx`, `WizardShell.tsx` (sólo el ancho del contenido), `TablaCostosLocal.tsx`, `costosLocal/FilaCostoLocalRow.tsx`, `SeccionCostosInternosPLLocal.tsx`, `SeccionConceptosVentaCotizacion.tsx`, `PasoResumenCotizacion.tsx`, `ResumenPL.tsx`, `WizardTotalsBar.tsx`.
- La cuadrícula de costos se arma con `WizardSection` + grid alineado; **no** se importa `@/components/ui/table` (prohibido por el sistema de diseño fuera de la allowlist).
- Sin cambios en hooks de cálculo (`useCotizacionWizardForm`, `calcTotalsPL`, `financialUtils`), ni en guardado, RPCs, permisos, IVA o tipo de cambio.
- Sólo tokens semánticos; sin colores ni estilos en línea.
- Pruebas focalizadas de los componentes tocados + snapshot de textos; `CHANGELOG.md` y `APP_VERSION` en el mismo cambio. CI, RLS y E2E completos quedan a GitHub Actions.

## Fuera de alcance

Nueva navegación por pasos, autoguardado, nuevos campos, cambios de reglas de negocio o de la lógica de tarifas.
