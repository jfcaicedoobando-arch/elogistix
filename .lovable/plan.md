# Plan: Mejoras al tab Facturación del embarque

## Lo que me pediste explícitamente

**Quitar las descargas inline.** Tanto en "Proformas Generadas" como en "Facturas del Embarque" las filas ya navegan (o navegarán) al detalle, donde el usuario descarga PDF/XML con contexto. Mantener botones aquí duplica acciones y satura la fila.

## Lo que no me gusta del tab actual (orden de impacto)

1. **No hay narrativa de flujo.** Los tres cards (Conceptos → Proformas → Facturas) se ven como bloques sueltos del mismo peso. El usuario no percibe que es un proceso secuencial.
2. **`HistorialFacturas` no es clickeable** mientras `HistorialProformas` sí lo es. Inconsistencia: una tabla te invita a clicar la fila, la otra no responde.
3. **Botón "Eliminar" siempre visible** en cada fila de proforma. Es una acción destructiva, no necesita ese protagonismo — debería vivir en un menú kebab o aparecer en hover.
4. **Columna "Operador" muestra el email completo** (`juanluis.martinez@elogistixshipping.com`) y empuja el ancho. Hay memoria del proyecto (`nombreDesdeEmail`) para mostrar el nombre.
5. **Doble columna "Total USD" + "Total MXN"** desperdicia espacio: 99% de las proformas son monomoneda y la otra columna queda en `—`. Una sola columna "Total" con la moneda correcta sería suficiente.
6. **Columna "Folio Factura" en proformas** duplica información que ya muestra la tabla de Facturas justo debajo.
7. **Estado de proforma apilado (2 badges)** es ruidoso. "Aprobada + Facturada" se puede colapsar a un solo badge "Facturada" (el estado terminal manda).
8. **Columna "Moneda" en Facturas** es redundante: el monto ya viene con prefijo USD/MXN.
9. **Falta indicación visual de "esto es clickeable"**: ni cursor `pointer` ni chevron al hover en las filas con drill-down.
10. **El header del tab no tiene contexto rápido** — no hay un resumen tipo "Facturado: USD 3,090 · Pendiente: 0" que rinda con un vistazo. El panel ya existe abajo pero queda enterrado.

## Cambios propuestos (UI únicamente, sin tocar lógica de datos)

### A. Limpieza de tablas

**`HistorialProformas`:**
- Eliminar columna "Acciones" completa.
- Mover "Eliminar" a un menú kebab `MoreHorizontal` al final de la fila (visible sólo cuando `canEdit && !facturada && !consolidada`).
- Eliminar columna "Folio Factura" (vive en la tabla de Facturas).
- Fusionar "Total USD" + "Total MXN" en columna única "Total" con la moneda real.
- Operador: aplicar `nombreDesdeEmail()` + `truncate` con tooltip del email completo.
- Estado: si `facturada`, mostrar sólo el badge "Facturada"; si no, badge único de revisión.
- Click en fila → `/proformas/:id` (ya funciona), añadir `cursor-pointer` + chevron sutil a la derecha al hacer hover.

**`HistorialFacturas`:**
- Eliminar columna "Archivos".
- Eliminar columna "Moneda" (el monto ya tiene prefijo).
- Hacer la fila clickeable: `onRowClick` → `/facturacion/:id`, con `cursor-pointer` + chevron al hover.
- Columna "Proforma": link visible (no sólo texto) que también navega a `/proformas/:id` (con `e.stopPropagation()` para no entrar en conflicto con el row click).

### B. Narrativa de flujo

Añadir un encabezado del tab con tres "pasos" mini-estado a la izquierda del card de Conceptos, mostrando el progreso del embarque:

```text
1. Conceptos     →   2. Proformas      →   3. Facturas
   2 facturados      1 generada (PRO-…)    1 emitida (#902)
```

Si un paso aún no aplica, queda en gris. Es puramente visual, no agrega cards nuevos.

### C. Eliminación de elementos no necesarios

- Quitar el `FacturaDownloadButton` de `HistorialProformas` (ya pidió drill-down).
- Quitar el `Download` (botón Descargar PDF de proforma) — el drill-down a `/proformas/:id` ya ofrece "Descargar PDF" prominente.
- Si después de quitar todo no queda ninguna acción inline para roles no-edit, el card se ve más limpio y rápido de escanear.

### D. Detalles menores

- `cursor-pointer` y `hover:bg-muted/40` consistentes en ambas tablas.
- Tooltip "Ver detalle" en filas clickeables (primera vez para descubribilidad — opcional).
- `Card` de Proformas: cuando hay ≥1, mostrar a la derecha del título un mini contador (`{n} proformas · {m} facturadas`).
- `Card` de Facturas: igual (`{n} facturas · total USD …`).

## Lo que NO incluye

- No se cambia el schema, RLS, ni la lógica de cálculo de estados (eso quedó arreglado en 13.90.5).
- No se rediseña visualmente (paleta, tipografía) — sigue siendo Libre Carga estándar.
- No se tocan los flujos de "Generar proforma" ni "Facturar proforma".
- No se borra ningún dato.

## Verificación

Playwright en `/embarques/7cbea742-…?tab=facturacion`:
1. Screenshot antes/después.
2. Confirmar que no hay botones de descarga en las dos tablas.
3. Clic en una fila de Facturas navega a `/facturacion/:id`.
4. Clic en una fila de Proformas navega a `/proformas/:id`.
5. El menú kebab de proforma abre y muestra "Eliminar" cuando corresponde.
6. Stepper visual muestra el progreso correcto.

## Archivos a editar

1. `src/features/embarques/components/facturacion/HistorialProformas.tsx` — limpieza de columnas, kebab menu, total único, nombreDesdeEmail.
2. `src/features/embarques/components/facturacion/HistorialFacturas.tsx` — onRowClick, limpieza de columnas, link a proforma.
3. `src/features/embarques/components/TabFacturacion.tsx` — añadir mini-stepper de flujo arriba.
4. Posible nuevo helper `src/features/embarques/components/facturacion/FlujoFacturacionStepper.tsx` (3 pasos visuales).
5. `appVersion.ts` → `13.90.6` + entrada en `CHANGELOG.md`.

## Pregunta antes de empezar

¿Quieres que también te muestre 2-3 direcciones visuales del **stepper de flujo** (por ejemplo: chips horizontales, breadcrumb con flechas, o tarjetas mini con números) antes de implementar? Si dices que sí, te las renderizo y eliges. Si dices que no, implemento directo el más limpio.
