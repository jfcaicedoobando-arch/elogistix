## Renombrar puerto CNSHK

Actualizar el registro en el catálogo de puertos (`puertos`) para que el código `CNSHK` muestre el nombre completo "Shenzhen Shekou" en lugar de solo "Shenzhen".

### Cambio

- `UPDATE public.puertos SET name = 'Shenzhen Shekou' WHERE code = 'CNSHK';`

### Impacto

- Aparecerá como **"Shenzhen Shekou, China (CNSHK)"** en `PortSelect` y en todas las vistas que leen del catálogo (cotizaciones, embarques, costeo de rutas, etc.).
- Los embarques/cotizaciones existentes que guardaron el string ya formateado (`"Shenzhen, China (CNSHK)"`) **no** se actualizan automáticamente. ¿Quieres que también haga un backfill para reemplazar el texto viejo en `embarques.puerto_origen/destino`, `cotizaciones`, etc.?

### Changelog

- Bump `APP_VERSION` y nueva entrada en `CHANGELOG.md` describiendo el rename.

### ¿Hay más puertos por renombrar?

Mencionas "unos puertos" en plural. Si tienes la lista completa, mándamela y los hago todos en una sola migración.

Renombrar CNYTN Shenzhen Yantian