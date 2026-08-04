# WAVE 2 (FIX 8–14): qué es bug real y qué no

Revisión de los 7 FIX de WAVE 2 contra el código actual (lectura de archivos, sin cambios). Resultado: **de ~24 sub-ítems, 14 son bugs reales, 4 no se reproducen (ya corregidos o mal diagnosticados) y 6 son mejoras válidas pero de diseño, no defectos**.

## Veredicto por hallazgo

### FIX 8 — Fechas y antigüedad
- 8.1 "Cartera etiqueta todo como Vence hoy" — **NO ES BUG**. Ya se corrigió (`carteraColumns.tsx`): "Vence hoy" sólo con 0 días; con días por vencer muestra "Vence en Nd".
- 8.2 "1 días vencida" — **REAL**. `documentoKpis.ts` no pluraliza. Ambas vistas leen el mismo `dias_vencido`, así que no hay dos cálculos distintos: sólo falta el singular y unificar el copy ("Antigüedad 15 d" vs "15 días vencida").
- 8.3 Stepper del embarque — **PARCIAL**. Hay tooltip con fecha, pero sin hora ni usuario, y no existe validación de coherencia temporal entre etapas (por eso se ve "Confirmado 04 ago" después de "En Tránsito 25 jul").

### FIX 9 — Agregados desincronizados
- 9.1 Total facturado del proveedor vs saldo en Compras — **REAL**. La ficha suma en el navegador lo que devuelve `fetchProveedorOperaciones` (sin filtros de estatus/organización equivalentes); Compras usa queries y RPC con filtros server-side. Fuentes distintas = números distintos.
- 9.2 Badges del sidebar vs listas — **REAL**. El badge de Embarques es una suma compuesta (demoras + garantías + admin pendiente) que no corresponde a ningún filtro de la lista; "Por aprobar" usa una RPC distinta de la query de la lista.
- 9.3 Conceptos de cotización descartados en silencio — **REAL**. `parseConceptosDetallado` cuenta `descartados` pero ningún componente lo muestra (sólo log en consola); si todos los conceptos son inválidos el documento muestra Total 0.00. Tampoco hay validación al guardar.

### FIX 10 — Sort multimoneda
- **REAL**. La columna Subtotal de cotizaciones ordena por el número crudo (`columnBuilders.tsx`), sin convertir moneda.

### FIX 11 — Pipeline y detalle de embarque
- 11.1 Dos botones "Editar" y sin CTA "Avanzar a Cerrado" — **REAL para roles sin permiso de cierre**. Cuando el siguiente estado es Cerrado y el rol no puede cerrar, el CTA principal cae a "Editar" y además se pinta el "Editar" secundario. Con rol admin/finanzas sí aparece "Avanzar a Cerrado".
- 11.2 Badge "Admin pendiente · N" no clicable — **REAL**.
- 11.3 Checklist de cierre — **PARCIAL**. El salto 1→3 existe en los metadatos (`cierreCheckMeta.ts`), pero la UI no numera los ítems, así que no se ve. El texto de éxito junto al saldo pendiente no se pudo reproducir con el formateador actual.
- 11.4 Campos "—" sin acción (Shipper) — **REAL** (mejora de UX, no defecto funcional).

### FIX 12 — Cobranza proactiva
- 12.1 Semáforo de mora — **YA EXISTE** en las bandejas (`aging.ts`), pero **falta en el detalle de la factura**.
- 12.2 "Enviar recordatorio" — **YA EXISTE** (módulo completo de cobranza, disponible desde Cartera); falta exponerlo en el detalle de la factura.
- 12.3 "Historial: sin eventos" — **NO ES BUG**. El historial viene de la RPC `historial_factura`; el mensaje sólo aparece cuando de verdad no hay eventos.
- 12.4 "≈ MXN equivalente" cuando ya es MXN — **REAL**.

### FIX 13 — Wizard de cotización
- 13.1 Pierde Origen/Destino al cambiar Tipo de movimiento — **NO SE REPRODUCE** en el código: ese handler sólo escribe `tipoMovimiento`.
- 13.2 "Re-cotizar" sólo en Aceptada — **PARCIAL**. "Re-cotizar" sí está restringido (y con razón: exige no tener embarques vinculados); "Duplicar" ya está disponible en cualquier estado desde la lista.
- 13.3 Typos — "esta esta" **NO EXISTE** ya. El resumen "Contenedores/BLs: 11" queda **por confirmar** (hay que leer el cálculo en `PasoResumenCotizacion.tsx`).

### FIX 14 — Listas y navegación
- 14.1 Clientes sin búsqueda ni saldo — **PARCIAL**. La búsqueda ya existe (server-side); la columna "Por cobrar" **no existe** (el saldo sólo se usa para el badge de crédito excedido).
- 14.2 Tarifario: "Nueva" en tarifa vencida — **REAL**. El badge tiene TTL de 7 días pero no excluye tarifas vencidas, y el delta "+USD vs mejor" también se pinta en vencidas.
- 14.3 Chip "Búsqueda: X" que no filtra — **NO SE REPRODUCE**. El término sí llega a la query paginada.

## Qué propongo hacer (si apruebas)

Fase 0 — cerrar dos dudas abiertas (lectura, sin cambios): el cálculo de "Contenedores/BLs" del resumen de cotización y los filtros exactos de `fetchProveedorOperaciones`.

Fase A — datos incorrectos (prioridad alta)
1. Unificar los agregados del proveedor con la fuente de Compras (mismos filtros de organización y estatus).
2. Ordenar Subtotal de cotizaciones por monto convertido a la moneda base; encabezado con nota de conversión.
3. Mostrar el aviso "N conceptos no se pudieron mostrar por datos incompletos" en el detalle de cotización y validar el schema al guardar.
4. Alinear los badges del sidebar con la lista que abren (mismo criterio o tooltip que explique la suma).

Fase B — coherencia de UI
5. Pluralizar y unificar el copy de antigüedad/vencimiento en un solo helper compartido.
6. Ocultar el equivalente "≈ MXN" cuando la moneda ya es la base.
7. Excluir tarifas vencidas de los badges "Nueva" y "+USD vs mejor".
8. Header del embarque: un solo "Editar" y, cuando el rol no puede cerrar, mensaje claro ("Requiere finanzas para cerrar") en lugar de un segundo "Editar".
9. Badge "Admin pendiente" clicable hacia la pestaña de cierre.
10. Tooltip del stepper con fecha y hora (y usuario si el dato existe) + aviso cuando las etapas están fuera de orden.

Fase C — mejoras de paridad
11. Semáforo de mora y botón "Enviar recordatorio" también en el detalle de la factura CxC.
12. Columna "Por cobrar" en la lista de clientes.
13. Empty states accionables en los campos "—" del resumen del embarque.

No se toca lo que resultó falso positivo (8.1, 12.3, 13.1, 13.3-typos, 14.3) ni la numeración interna del checklist, que no se ve en pantalla.

## Notas técnicas
- La validación fue estática (lectura de código). Los ítems 9.1 y 9.2 son divergencias de diseño (queries independientes), aún no reproducidas con datos reales; la Fase 0 y una consulta a la base lo confirman antes de tocar código.
- Reglas del proyecto que aplican: archivos ≤200 líneas, sin `any`, helpers de fecha centralizados, `roundMoney` para dinero, y registro en `CHANGELOG.md` + bump de `APP_VERSION` por cada entrega.
- Cada fase se entrega por separado con su bump de versión para poder validar en preview entre pasos.
