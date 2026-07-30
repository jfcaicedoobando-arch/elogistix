# Auditoría de diseño — Estado de cuenta de clientes

Capturas tomadas en 1366×768 sobre `/clientes/:clienteId/estado-de-cuenta` (INDIMEX TRADING, 116 facturas, histórico).

## Hallazgos

1. **KPI truncado**: "Saldo Total Adeudado" muestra `MXN 56,840.00 USD 458,1…`. El helper `formatDual` une los dos importes con `\n`, pero `KpiCard` no respeta saltos de línea, así que se corta el importe más importante de la pantalla.
2. **Sin identidad del cliente ni periodo**: el encabezado dice sólo "Estado de cuenta". Odoo/QuickBooks encabezan con cliente, RFC, condiciones de crédito, periodo del reporte y fecha de corte.
3. **Faltan buckets de antigüedad**: no hay la fila clásica Corriente / 1-30 / 31-60 / 61-90 / +90, que es el corazón de un statement de QuickBooks.
4. **Sin saldo acumulado ni fila de totales**: la tabla no tiene columna "Saldo acumulado" (running balance) ni pie con totales por moneda. Un estado de cuenta debe cuadrar visualmente.
5. **Monedas mezcladas sin separar**: MXN y USD conviven en la misma tabla y una celda MXN se parte en dos renglones. No hay subtotal por moneda.
6. **Faltan columnas clave**: no aparece fecha de vencimiento ni días vencidos; sin eso el estatus "Vigente/Vencida" no es auditable.
7. **Semántica de badges**: "Vigente" usa `outline` (gris) y "Pagada" usa `default` (oscuro/primario), al revés de la convención de la app (pagado = neutro, por vencer = ámbar).
8. **Toolbar desconectada**: PDF / CSV / Enviar flotan sueltos arriba de los KPIs; los filtros viven en otra tarjeta separada de la tabla.
9. **Sin orden, búsqueda ni paginación**: con 116 movimientos se hace scroll infinito, sin ordenar por columna ni buscar folio/expediente.
10. **Encabezado "SALDO INSOLUTO" se parte** en dos líneas a 1366 px por ancho de columna mal repartido.

## Qué se construye

**A. Encabezado tipo statement**
- Franja de identidad: nombre del cliente (title case), RFC monoespaciado, días de crédito y límite; a la derecha, "Periodo: DD/MM/AAAA – DD/MM/AAAA" y "Corte al DD/MM/AAAA".
- Acciones PDF / CSV / Enviar se mueven a la derecha del encabezado, agrupadas.

**B. KPIs legibles y por moneda**
- `formatDual` deja de usar `\n`: cada KPI muestra el importe principal grande y el segundo importe como sublabel ("+ USD 458,120.00"), sin truncar.
- Cuarta tarjeta opcional "Antigüedad promedio (días)".

**C. Barra de antigüedad (aging)**
- Nuevo componente con 5 buckets (Corriente, 1-30, 31-60, 61-90, +90) por moneda, cada uno clicable para filtrar la tabla.
- Cálculo puro en `estadoCuentaAggregates.ts` con tests unitarios.

**D. Tabla contable**
- Filtros + búsqueda + tabla en una sola tarjeta (toolbar integrada como en Odoo).
- Columnas: Fecha, Folio, Concepto, Vencimiento, Días, Cargo, Abono, Saldo, Saldo acumulado, Estatus.
- Agrupación por moneda con encabezado de sección y subtotal por grupo; pie sticky con totales de cargos, abonos y saldo.
- Orden por columna (fecha, vencimiento, saldo) y paginación de 25 con densidad compacta.
- Anchos fijos y `whitespace-nowrap` en importes para que ninguna celda se parta en 1366 px.

**E. Badges y estados**
- `Pagada`/`Sin saldo` → neutro; `Vigente` → outline; `Por vencer` → warning; `Vencida` → destructive, alineado con `uiMappings`.

**F. Consistencia**
- Los mismos componentes sirven al portal del cliente (`EstadoCuentaModule` ya es compartido), así que el portal hereda el rediseño.

## Detalles técnicos

- Archivos a tocar: `EstadoCuentaModule.tsx`, `EstadoCuentaKpiCards.tsx`, `EstadoCuentaFilters.tsx`, `EstadoCuentaTable.tsx`, `EstadoCuentaInterno.tsx`, `estadoCuentaAggregates.ts` (+ nuevos `EstadoCuentaAgingBar.tsx`, `EstadoCuentaHeader.tsx`, `estadoCuentaAging.ts`).
- Sólo capa de presentación y agregados puros en cliente; no se tocan RPCs ni RLS. El PDF (`estadoCuentaPdf.ts`) se alinea después en un paso aparte si lo quieres.
- Se respeta Power of 10: cada archivo nuevo ≤200 líneas, sin `any`, tests para los agregados de aging y saldo acumulado.
- Verificación: capturas en 1366×768 y 1920×1080, `lint`, `typecheck` y tests; bump de `APP_VERSION` + `CHANGELOG.md`.
