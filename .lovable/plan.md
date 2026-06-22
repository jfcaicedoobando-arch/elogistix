## Problema 1 — Error en Historial

El RPC `historial_proveedor_factura` revienta con:
```
invalid input value for enum motivo_nota_credito_proveedor: ""
```
Causa: en la rama "Notas de crédito" compara `nc.motivo <> ''`, pero `motivo` es un enum, no texto. Postgres intenta convertir `''` al enum y falla.

**Fix**: nueva migración que reemplaza el RPC con `nc.motivo::text <> ''` (cast explícito a texto). Misma firma, mismo retorno, sin cambios en el cliente.

## Problema 2 — Más información de la factura

Hoy el modal sólo muestra KPIs (Total / Pagado / Saldo / # Pagos). Vamos a agregar una sección **"Información de la factura"** arriba del Historial con:

- **Categoría contable** (nombre, no UUID)
- **RFC proveedor** y **UUID fiscal (CFDI)**
- **Subtotal, IVA, Retenciones, Total** desglosados
- **Moneda y TC USD** (cuando aplique)
- **Días de crédito** y **embarque vinculado** (si existe)
- **Notas** (si existen, en bloque colapsable)

### Cambios técnicos

1. `src/features/cxp/services/proveedorFacturas.helpers.ts`
   - Extender `PROVEEDOR_FACTURAS_SELECT` para incluir: `subtotal, iva, retenciones, rfc_proveedor, uuid_fiscal, dias_credito, notas, presupuesto_categorias!categoria_presupuesto_id(nombre)`.
   - Extender `Joined` y `mapJoinedRow` con esos campos + `categoria_nombre`.

2. `src/features/cxp/services/proveedorFacturas.ts`
   - Agregar a la interface `FacturaCxP`: `subtotal, iva, retenciones, rfc_proveedor, uuid_fiscal, dias_credito, notas, categoria_nombre`.

3. `src/features/cxp/components/DialogDetallePagosProveedor.tsx`
   - Nuevo bloque `InfoFacturaSection` (mismo archivo, ≤200 líneas; si crece, archivo aparte) entre los KPIs y el Historial: grid 2 cols con etiquetas pequeñas y valores en mono/tabular, montos formateados con `formatCurrency`. Notas en bloque pleno cuando existan.

4. Migración SQL — `CREATE OR REPLACE FUNCTION public.historial_proveedor_factura` con el cast `nc.motivo::text <> ''`. Resto idéntico.

5. `src/constants/appVersion.ts` → `13.110.0`.

6. `CHANGELOG.md` — entrada `[13.110.0]`:
   - Fix: historial de factura de proveedor (cast enum motivo).
   - Mejora: modal "Detalle de factura de proveedor" muestra categoría contable, RFC, UUID fiscal, desglose fiscal, días de crédito y notas.

### Fuera de alcance

- No se tocan permisos, RLS, ni el flujo de aprobación.
- No se agregan ediciones inline; la sección es sólo de lectura.
- Tabla de pagos y sección de Notas de crédito quedan igual.
