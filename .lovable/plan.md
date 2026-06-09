# Fix: Dashboard Ejecutivo — relationship proveedor_facturas ↔ proveedores

## Causa raíz
Regresión introducida en **v12.64.0** ("segmentación Nacional/Extranjero"). El servicio `fetchFacturasCxP` (`src/services/cxp/proveedorFacturas.ts:77`) embebe `proveedores(origen_proveedor)`, pero la tabla `public.proveedor_facturas` **no tiene FK** a `public.proveedores`. PostgREST rechaza el embed con:

> `Could not find a relationship between 'proveedor_facturas' and 'proveedores' in the schema cache`

El Dashboard Ejecutivo cae porque su cadena es:
`useDashboardEjecutivo → fetchDashboardEjecutivo → fetchResumenTesoreria → fetchFacturasCxP → embed roto`.

Es probable que `/cxp` también esté fallando al cargar (mismo embed); el usuario lo notó primero en el dashboard porque ahí se consolida todo en una sola pantalla.

## Validación previa
- `pg_constraint` sobre `proveedor_facturas`: solo PK, UNIQUE y FK a `presupuesto_categorias`. **No hay FK a `proveedores`.**
- `SELECT COUNT(*)` de filas con `proveedor_id` huérfano: **0** → es seguro crear la FK.

## Fix (1 migration + 1 cambio menor de código)

### 1. Migration: agregar FK + refrescar schema cache
```sql
ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_proveedor_id_fkey
  FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id)
  ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';
```
- `ON DELETE RESTRICT` se alinea con la regla "Data Integrity" (no permitir borrar proveedores con facturas).
- `NOTIFY pgrst` fuerza a PostgREST a recargar el schema cache inmediatamente.

### 2. Regenerar `src/integrations/supabase/types.ts`
Lo hace Lovable automáticamente al aplicar la migration; no se edita a mano.

### 3. No tocar `proveedorFacturas.ts`
El embed actual ya es correcto una vez que existe la FK. Mantengo el `SAFE-CAST` y el shape `Joined`.

### 4. Bump APP_VERSION → `12.64.4` + entrada en `CHANGELOG.md` describiendo el fix de relación.

## Validación post-fix
- Refresco `/profit/dashboard` en preview (con el usuario logueado) y confirmo que carga sin el toast de error.
- Verifico que `/cxp` también lista facturas con la columna Origen.
- Corro los tests existentes de CxP/tesorería con `bunx vitest run src/services/cxp src/services/tesoreria src/services/dashboard-ejecutivo` para asegurar que el cambio de schema no rompió mocks.

## Notas
- No requiere republish del frontend — el fix es 100% backend (DB schema cache).
- Producción actual (`librecarga.com`) recibirá el fix inmediatamente al aplicar la migration; el bundle del frontend ya pide el embed correcto.
