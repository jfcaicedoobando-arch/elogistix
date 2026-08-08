# Revisión y mejora de los tres reportes de antigüedad

Sí, la antigüedad (aging) ya existe en LibreCarga, en tres pantallas:

| Pantalla | Ruta | Qué muestra |
|---|---|---|
| Antigüedad CxC | `/cobranza/aging` | Saldo por cliente en cubetas de días |
| Antigüedad CxP | `/compras/aging` | Saldo por proveedor en cubetas, con selector de moneda |
| Cartera y antigüedad | `/reportes/cartera` | Reporte contable CxC + CxP factura por factura, con fecha de corte y valuación en pesos |

Las tres se quedan. Este plan corrige las incoherencias entre ellas.

## Hallazgo crítico: la antigüedad de clientes mezcla monedas

La función de base de datos que alimenta `/cobranza/aging` suma los saldos de todas las facturas sin separar la moneda, y la pantalla rotula el resultado como pesos. Hoy, de las facturas de cliente abiertas, 95 están en moneda extranjera y sólo 7 en pesos: el total mostrado no es interpretable (es como sumar kilos con libras y escribir "kilos"). La antigüedad de proveedores ya resolvió esto en su momento con una fila por proveedor y moneda; la de clientes se quedó atrás.

## Qué se va a hacer

### 1. Antigüedad CxC: separar por moneda (crítico)
- Nueva versión de la función de base de datos que devuelve una fila por cliente **y moneda**.
- La pantalla gana el mismo selector de moneda (MXN / USD / EUR) que ya usa la de proveedores, los KPIs se formatean en la moneda activa y el nombre del archivo exportado la incluye.

### 2. Definición única de cubetas
- Una sola fuente de verdad para las cubetas y sus etiquetas, compartida por las tres pantallas: **Vigente · 1-30 · 31-60 · 61-90 · +90 días**, con el mismo color por rango.
- El reporte de Reportes deja de decir "Por vencer" y dice "Vigente", igual que las otras dos.

### 3. Fecha de corte en las tres
- Las pantallas de CxC y CxP hoy siempre usan la fecha de hoy aunque la base ya acepta una fecha de corte. Se agrega el mismo selector de fecha que ya tiene el reporte de Reportes, para poder cerrar el mes con corte al día 30.

### 4. Exportación consistente
- La exportación de proveedores se alinea con el estándar del sistema: aviso de éxito/vacío, acentos correctos en Excel y encabezados con la fecha de corte y la moneda.
- Las tres pantallas dicen en su encabezado a qué fecha está calculada la información.

### 5. Drill-down parejo y limpieza
- Al hacer clic en un cliente se abrirá el detalle de sus facturas con saldo, como ya ocurre con proveedores.
- Se elimina el código muerto de drill-down que quedó en la pantalla de clientes y se unifica la tarjeta de KPI duplicada en dos archivos.
- Ambas pantallas muestran el mismo bloque de error con botón "Reintentar".

### 6. Navegación
- Desde cada pantalla por contraparte se podrá saltar al reporte contable de Reportes con la misma fecha de corte, y viceversa, para que quede claro que son vistas del mismo dato (resumen por cliente/proveedor vs. detalle contable por factura).

## Detalles técnicos

- Migración: nueva firma de `cxc_aging_clientes(p_org, p_fecha)` agregando `moneda` al `RETURNS TABLE` y al `GROUP BY`; mismo patrón de aislamiento por organización y `SECURITY DEFINER` que la versión actual. Se conserva `cxp_aging_proveedores` sin cambios.
- Nuevo módulo compartido `src/lib/aging/buckets.ts` (tipo `CubetaAging`, `bucketDeDias`, etiquetas y tonos). `src/features/cxp/components/agingBuckets.ts` y `src/features/reportes/cartera/domain/agingCartera.ts` reexportan desde ahí para no romper importaciones.
- `useCxcAging` / `useCxpAging` reciben `fecha` y la propagan a la clave de caché; las pantallas sincronizan la fecha por parámetro de URL con `DatePickerMx`.
- `KpiBucket` queda sólo en `src/components/shared/kpi/AgingKpiBucket.tsx`; se borra la copia local de `CxcAging.tsx`.
- Nuevo `CxcAgingDrillDownDialog` siguiendo el patrón de `AgingDrillDownDialog` de CxP.
- Pruebas: cubetas compartidas (límites 0/1/30/31/60/61/90/91), totales por moneda de CxC y no-mezcla de monedas.
- `CHANGELOG.md` + `APP_VERSION`.
