## Objetivo

Permitir hacer drilldown desde la tabla de Cartera (`/cartera`) hacia el detalle de cada factura (`/facturacion/:id`) haciendo clic en cualquier parte de la fila, no solo en el folio.

## Contexto actual

- Hoy sólo el folio (columna "Folio") es un `<Link>` a `/facturacion/${factura_id}`. El resto de la fila no es clickeable.
- En mobile, las tarjetas de `CarteraMobileList` tampoco navegan al detalle: sólo el folio y el expediente son links.
- El `DataTable` compartido ya soporta `onRowClick` (agrega `cursor-pointer` y dispara el handler), y las columnas con links internos ya usan `e.stopPropagation()` para no chocar con el row-click (regla del proyecto).

## Cambios

1. **`src/features/bandejas/routes/Cartera.tsx`**
   - Importar `useNavigate` de `react-router-dom`.
   - Pasar `onRowClick={(r) => navigate('/facturacion/' + r.factura_id)}` al `<DataTable>`.

2. **`src/features/bandejas/routes/_sections/CarteraMobileList.tsx`**
   - Envolver cada `<li>` con un `<Link to={/facturacion/${row.factura_id}}>` (o convertir el `<li>` en un contenedor clickeable con el link como capa principal), manteniendo los links internos al embarque con `e.stopPropagation()` para que no se dispare el link exterior.
   - Añadir estilos `hover:bg-muted/40 cursor-pointer` para dar feedback.

3. **Versionado y bitácora**
   - Bump `APP_VERSION` en `src/constants/appVersion.ts` a `13.199.3`.
   - Añadir entrada en `CHANGELOG.md`: "Cartera: drilldown a detalle de factura desde toda la fila (desktop) y tarjeta (mobile)."

## Fuera de alcance

- No se cambian columnas, filtros, orden, paginación ni lógica de negocio.
- No se toca el hook `useCarteraPendiente` ni el endpoint.
