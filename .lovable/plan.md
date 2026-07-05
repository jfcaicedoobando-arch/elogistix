# Homologar columna "# Factura" con el resto de tablas

## Problema

En `/facturacion` la primera columna renderiza el folio como `<Link>` con `text-accent hover:underline`, lo que en México se lee como "hazme clic". Confunde: la fila entera ya es clickeable (`onRowClick` navega al detalle en `TabFacturasEmitidas.tsx:168`), y ninguna otra tabla del sistema (Cotizaciones, Clientes, CxP, Proveedores, Embarques Activos, Oportunidades, Leads) usa Link azul en su primera columna — todas confían en el click de fila.

## Cambio

`src/features/facturacion/routes/facturacionColumns.tsx`, cell de la columna `numero`:

- Reemplazar el `<Link to={`/facturacion/${row.original.id}`} className="text-accent hover:underline">` por un simple `<span>` con la tipografía normal de la tabla (heredada de `font-medium whitespace-nowrap` que ya define el `meta` de la columna).
- Conservar el `AmbienteBadge` a la derecha.
- Conservar el placeholder "Sin folio (borrador)" en itálicas muted cuando el número empieza por `BORRADOR-`.
- Eliminar el import de `Link` (queda huérfano).

Resultado: el folio se ve como texto normal, la fila entera navega al detalle, y el módulo queda consistente con el resto de la app.

## Fuera de alcance

- No se toca `onRowClick`; la navegación por fila sigue igual.
- No se cambian otras columnas ni el badge de ambiente.
- No se altera el detalle de factura ni sus enlaces internos.
- No se homologan otras tablas ajenas a esta lista (no hay evidencia de que las tengan mal).

## Changelog

Bump `APP_VERSION` a `13.172.13` + entrada en `CHANGELOG.md`:
> UI Facturación: el folio de la primera columna deja de renderizarse como enlace azul. La fila entera ya navega al detalle (`onRowClick`), homologando la tabla con Cotizaciones, Clientes, CxP y Proveedores.
