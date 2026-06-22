## Problema

Los tests de arquitectura (`audit-report.test.ts` y `architecture-baseline.test.ts`) fallan porque `src/features/cxp/services/proveedorFacturas.ts` quedó en 218 líneas (límite Power of 10: 200) después de agregar `fetchFacturaProveedor` y extraer `mapJoinedRow` en la versión 13.106.6.

## Plan

Extraer helpers puros a un módulo aparte, sin cambiar API pública ni comportamiento.

### 1. Crear `src/features/cxp/services/proveedorFacturas.helpers.ts`
Mover a este archivo (sin tocar lógica):
- Tipo interno `Joined`
- Funciones puras: `diasVencido`, `clasificar`, `mapJoinedRow`, `aplicarFiltrosCliente`
- El select string (`PROVEEDOR_FACTURAS_SELECT`) como constante exportada, para reusar en `fetchFacturasCxP` y `fetchFacturaProveedor` y evitar duplicar las 7 líneas del embed.

### 2. Adelgazar `proveedorFacturas.ts`
Importar de `./proveedorFacturas.helpers` y dejar sólo:
- Tipos públicos (`FacturaCxP`, `EstatusCxP`, `FetchCxPFiltros`, etc.)
- Funciones que tocan Supabase: `fetchFacturasCxP`, `fetchFacturaProveedor`, `crearFacturaProveedor`, `existeFacturaDuplicada`, `softDeleteFacturaProveedor`
- Re-export de KPIs existente

Resultado esperado: ambos archivos bajo 200 líneas. Sin cambios en consumidores (mismas exportaciones públicas).

### 3. Versionado
- `APP_VERSION` → `13.106.7`
- Entrada `[13.106.7]` en `CHANGELOG.md`: "refactor(cxp): dividir proveedorFacturas.ts en service + helpers para cumplir Power of 10 (≤200 líneas)".

### 4. Verificación
Re-correr los 4 tests del comando original. Deben pasar en verde.

## Analogía

Es como cuando un cajón se llena: en vez de comprimir la ropa, sacamos los calcetines a un cajón aparte. La función pública (abrir el clóset y elegir qué ponerte) sigue idéntica.
