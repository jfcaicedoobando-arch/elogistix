## Mejora: Filtro de rango de fechas en Pre-Facturación

Agregar un selector unificado **Desde / Hasta** que aplique a las 5 pestañas del módulo (`/facturacion`): Proyección, Pendientes, Proformas, Facturas y Liquidación de Gastos. El filtro será sobre la **fecha de emisión** de cada documento (o equivalente para gastos / proyección).

### UX

- Barra de filtros en la parte superior de la página, **arriba de los Tabs**, para que el rango persista al cambiar entre pestañas.
- Componente `DateRangeFilter` con dos `Popover` + `Calendar` shadcn (locale es-MX, formato DD/MM/YYYY).
- Presets rápidos como chips: **Hoy · Esta semana · Este mes · Mes anterior · Año actual · Limpiar**.
- Badge contador mostrando el rango activo (ej. "01/05/2026 – 27/05/2026") con botón ✕ para limpiar.
- Por defecto: **mes en curso** (1 del mes actual → hoy).
- El estado se sincroniza en la URL (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`) para poder compartir vistas y sobrevivir recargas.

### Campos de fecha por pestaña

| Pestaña | Campo filtrado |
|---|---|
| Proyección | `fecha_estimada_cierre` (o ETA del embarque) |
| Pendientes | `fecha_emision` de la proforma |
| Proformas | `fecha_emision` |
| Facturas | `fecha_emision` |
| Liquidación de Gastos | `fecha` del gasto |

### Cambios técnicos

1. **Nuevo componente** `src/components/facturacion/DateRangeFilter.tsx` (~150 líneas):
   - Props: `value: { desde?: Date; hasta?: Date }`, `onChange`, presets opcionales.
   - Usa `Popover` + `Calendar` de shadcn con `pointer-events-auto`.
   - Valida `desde <= hasta` y deshabilita días fuera de rango en el segundo calendario.
   - Locale `es` de `date-fns` para los nombres de meses/días.

2. **Nuevo hook** `src/hooks/facturacion/useFacturacionDateRange.ts`:
   - Lee/escribe los query params `desde` y `hasta` con `useSearchParams`.
   - Devuelve `{ desde, hasta, setRango, isInRange(dateString) }`.
   - Default: primer día del mes actual → hoy.

3. **`src/pages/facturacion/Facturacion.tsx`**: insertar `<DateRangeFilter>` arriba de `<Tabs>` y pasar el rango (vía hook) a los 5 controllers.

4. **Controllers** (cambios pequeños, sólo agregar el filtro al `useMemo` que ya filtra por search/estado):
   - `useFacturacionPageController` — facturas + gastos.
   - `useTabProformasController` — proformas.
   - `useTabProformasPendientesController` — pendientes.
   - `useTabProyeccionController` — proyección.

   Cada uno acepta `{ desde, hasta }` como argumento y filtra el array en memoria (los datos ya se traen completos; no requiere cambio en queries Supabase).

5. **Exportaciones CSV** (CSV de facturas, layout contable, CSV de proformas, CSV de huecos): respetan el rango activo automáticamente porque exportan `filtered`, no el dataset completo.

6. **Changelog + versión**: bump `APP_VERSION` a `12.0.1` y entrada en `CHANGELOG.md`.

### Lo que NO se toca

- Estructura de Tabs, columnas de las tablas, lógica de marcado de pagado/facturada.
- Filtros existentes (search, estado, toggle pendiente/facturada) — siguen funcionando en combinación con el rango.
- Queries a Supabase: el filtrado es client-side sobre los datos ya cacheados por React Query.
- Otros filtros (cliente, moneda, monto) — quedan fuera de scope por decisión explícita.
