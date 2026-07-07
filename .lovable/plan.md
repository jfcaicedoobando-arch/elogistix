
## Diagnóstico

Reproduje el caso con `ELEXP00250` (embarque `77780925…`, ETD 2026-04-12):

- Tiene 3 conceptos de venta, todos con `estado_facturacion='en_proforma'`.
- Los 3 apuntan a 2 proformas con `estado_proforma='facturada'`, `origen='gap_externo'`, sin `factura_id` ni `folio_factura_externa` (aceptación histórica del back-fill).
- El RPC `validar_cierre_embarque` **ya lo considera OK** en la regla `venta_conceptos_facturados` (pasa como facturado por proforma histórica).
- **Pero** la lista "Hueco de facturación" (que alimenta la bandeja "Por facturar" y el KPI del dashboard) sólo excluye embarques que tengan una fila real en `facturas` con `factura_pdf_url` para el mismo expediente. Como estos embarques no tienen CFDI, se cuelan al hueco y se muestran como "falta factura".

Analogía: el checklist interno del embarque ya sabe que "una nota vieja firmada por el cliente" cuenta como facturado, pero el radar del dashboard sigue buscando sólo CFDI oficiales, así que ELEXP00250 aparece en las dos listas contradictorias.

Medición en BD: hoy hay **71** embarques en el hueco; **18** de ellos (incluye ELEXP00250) tienen todos sus conceptos cubiertos por proformas `facturada`. Después del fix, el hueco debe quedar en **53**.

## Cambios

### 1. `src/features/facturacion/services/huecoFacturacion/fetchSources.ts`
Añadir una consulta paralela nueva `fetchConceptosVentaDeEmbarques(ids)` que traiga:
```
id, embarque_id, estado_facturacion, proforma_id, deleted_at,
proformas!inner ( id, estado_proforma, deleted_at )
```
filtrando `deleted_at IS NULL` en los conceptos.

Exponerla desde `fetchVentasYFacturas` en el mismo `Promise.all` (renombrarlo internamente a `fetchDatosHueco`), devolviendo `{ ventas, facturas, conceptosDetalle }`. Los `ventas` que ya se usan para calcular MXN/USD no cambian de forma.

### 2. `src/features/facturacion/services/huecoFacturacion/index.ts`
Antes de construir cada fila:
- Construir un `Set<string> excluidosPorProformaHistorica` con los `embarque_id` que cumplen:
  - Tienen ≥ 1 concepto de venta no borrado.
  - **Todos** sus conceptos no borrados tienen `estado_facturacion='en_proforma'` **y** su proforma asociada tiene `estado_proforma='facturada'` y no está borrada.
- En el bucle actual, añadir `if (excluidosPorProformaHistorica.has(e.id)) continue;` justo después del check existente por `facturadosSet`.

Regla puramente aditiva: no cambia el comportamiento para embarques con CFDI real, ni para los que tienen conceptos sueltos o proformas aún no facturadas.

### 3. `src/features/facturacion/services/huecoFacturacion/buildFilas.ts`
Sin cambios de lógica. Sólo documentar en el JSDoc del módulo la nueva condición de exclusión "todos los conceptos ya viven en una proforma marcada como `facturada` (aceptación histórica)".

### 4. Tests
- `src/features/facturacion/services/huecoFacturacion/__tests__/buildFilas.test.ts`: agregar caso "excluye embarque cuando todos los conceptos están en proformas facturadas" y caso "no excluye si al menos un concepto sigue `pendiente` o vive en proforma no-facturada".
- Ajustar el mock/`_supabaseChainMock` para la nueva query de conceptos_venta si algún test integrador del hook `useHuecoFacturacion` deja de pasar.

### 5. Bandeja / KPI (sin cambios de código)
`BandejaPorFacturar` y el KPI "Por facturar" del `DashboardEjecutivoFacturacion` leen del mismo hook `useHuecoFacturacion`, así que ambos bajarán automáticamente al mismo número corregido.

### 6. Versionado
- Bump `APP_VERSION` a `13.213.3` en `src/constants/appVersion.ts`.
- Entrada nueva en `CHANGELOG.md`:
  > **Fix:** el "Hueco de facturación" (bandeja "Por facturar" + KPI) ahora respeta la aceptación histórica: si todos los conceptos de venta de un embarque ya viven en proformas con `estado_proforma='facturada'`, el embarque se considera facturado aunque no exista CFDI. Alinea la bandeja con lo que ya reportaba `validar_cierre_embarque`. Ejemplo: `ELEXP00250` deja de aparecer.

## Fuera de alcance

- **No** se emiten CFDI faltantes ni se "curan" los back-fills — sólo se cambia el criterio de conteo.
- **No** se toca el RPC `validar_cierre_embarque` (ya usa la definición correcta).
- **No** se cambia la definición de "Proformas listas" (fix anterior de `13.213.1` sigue vigente).
- **No** se limpia data legacy en BD.

## Verificación

1. En el navegador, la bandeja "Por facturar" y el KPI deben bajar de 43 → **53** (¿o el número exacto que dé el hook filtrado; DB midió 71→53 hoy). El embarque `ELEXP00250` no aparece.
2. Consulta de control en BD antes/después:
   ```sql
   -- Debe devolver 0 embarques con TODOS los conceptos en proformas 'facturada'
   -- después del despliegue (visto desde la UI del hueco).
   ```
3. Tests unitarios nuevos pasan; los existentes de `buildFilas`/`useHuecoFacturacion` siguen verdes.
